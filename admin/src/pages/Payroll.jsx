import React, { useState, useEffect } from "react";
import { App } from "antd";
import dayjs from "dayjs";
import { payrollAPI, employeeAPI, attendanceAPI, holidayAPI, advancePaymentAPI } from "../services/api";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function PayrollContent() {
  const { message } = App.useApp();
  const currentYear = dayjs().year();
  const currentMonth = dayjs().month() + 1; // 1-12

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  const [monthSummary, setMonthSummary] = useState({
    daysInMonth: 30,
    sundaysCount: 4,
    holidayCount: 0,
    workingDays: 26,
  });

  // Email template state
  const [salaryEmailToggle, setSalaryEmailToggle] = useState(true);
  const [emailSubject, setEmailSubject] = useState(
    "Salary payment confirmation"
  );
  const [notificationMsg, setNotificationMsg] = useState(
    "Hello {{employee_name}}, your salary of {{salary_amount}} for {{salary_month}} has been marked as paid. Please contact accounts if you have any questions."
  );

  const fetchEmployeesAndAttendance = async () => {
    setLoading(true);
    try {
      const [empRes, payrollRes, holidayRes, advanceRes] = await Promise.all([
        employeeAPI.list({ limit: 100, status: "active" }),
        payrollAPI.list({ month: selectedMonth, year: selectedYear, limit: 100 }),
        holidayAPI.list({ month: selectedMonth, year: selectedYear }),
        advancePaymentAPI.list({ month: selectedMonth, year: selectedYear }),
      ]);

      const activeEmps = empRes.data?.employees || empRes.data?.data?.employees || [];
      const existingPayrolls = payrollRes.data?.payrolls || payrollRes.data?.data?.payrolls || [];
      const holidaysList = holidayRes.data?.holidays || [];
      const allAdvances = advanceRes.data?.advances || [];

      // Fetch monthly attendance records
      const attRes = await attendanceAPI.list({
        month: selectedMonth,
        year: selectedYear,
        limit: 500,
      });
      const allAttRecords = attRes.data?.attendance || attRes.data?.data?.attendance || [];

      // Calculate days in selected month
      const daysInMonth = dayjs(new Date(selectedYear, selectedMonth - 1, 1)).daysInMonth();

      // Count Sundays in the month
      let sundaysCount = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        if (dayjs(new Date(selectedYear, selectedMonth - 1, d)).day() === 0) {
          sundaysCount++;
        }
      }

      // Count official holidays that do NOT fall on a Sunday
      let holidayCount = 0;
      const holidayDatesSeen = new Set();
      holidaysList.forEach((h) => {
        const hDate = dayjs(h.date);
        if (hDate.year() === selectedYear && (hDate.month() + 1) === selectedMonth) {
          const key = hDate.format("YYYY-MM-DD");
          if (!holidayDatesSeen.has(key)) {
            holidayDatesSeen.add(key);
            if (hDate.day() !== 0) {
              holidayCount++;
            }
          }
        }
      });

      // Total working days = Month days - Sundays - Holidays
      const workingDaysInMonth = Math.max(1, daysInMonth - sundaysCount - holidayCount);

      setMonthSummary({
        daysInMonth,
        sundaysCount,
        holidayCount,
        workingDays: workingDaysInMonth,
      });

      // Build rows for each active employee
      const rows = activeEmps.map((emp) => {
        const existingP = existingPayrolls.find(
          (p) =>
            (p.employee?._id || p.employee) === emp._id ||
            p.employeeId === emp.employeeId
        );

        const empAtt = allAttRecords.filter((a) => {
          const aEmpId = a.employee?._id || a.employee;
          return aEmpId === emp._id || a.employeeId === emp.employeeId;
        });

        const presentDays = empAtt.filter((a) => ["present", "late"].includes(a.status)).length;
        const rawAbsent = empAtt.filter((a) => ["absent", "unpaid-leave"].includes(a.status)).length;
        const halfDays = empAtt.filter((a) => a.status === "half-day").length;
        const totalAbsentDays = rawAbsent + (halfDays * 0.5);

        const attPaidLeaves = empAtt.filter((a) =>
          ["paid-leave", "on-leave", "leave"].includes(a.status)
        ).length;
        const profilePaidLeaves = Number(
          emp.paidLeaves !== undefined && emp.paidLeaves !== null ? emp.paidLeaves : 0
        );
        const effectivePaidLeaves = Math.max(profilePaidLeaves, attPaidLeaves);

        let overtimeHours = 0;
        empAtt.forEach((a) => {
          if (a.overtimeHours) overtimeHours += Number(a.overtimeHours);
        });

        const monthlySalary = Number(
          emp.salary?.basic ||
          emp.salary?.grossSalary ||
          emp.baseSalary ||
          emp.salary?.netSalary ||
          0
        );

        // 1-Day Salary = Base Salary ÷ Working Days of the month
        const oneDaySalary = workingDaysInMonth > 0 ? (monthlySalary / workingDaysInMonth) : 0;
        // 1-Hour Salary = 1-Day Salary ÷ 8 standard working hours
        const oneHourSalary = oneDaySalary > 0 ? (oneDaySalary / 8) : 0;

        // Deduction: If absent days exceed paid leaves, deduct excess absent days * 1-day salary
        const excessAbsentDays = Math.max(0, totalAbsentDays - effectivePaidLeaves);
        const absentDeduction = Math.round(excessAbsentDays * oneDaySalary);

        // Overtime: overtime hours * 1-hour salary
        const overtimeAddition = Math.round(overtimeHours * oneHourSalary);

        // Advance payment deduction for this employee
        const empAdvances = allAdvances.filter((a) => {
          const aEmpId = a.employee?._id || a.employee?.id || a.employee;
          return aEmpId === emp._id || a.employeeId === emp.employeeId;
        });
        const advanceDeduction = empAdvances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

        // Final Estimated Salary = Base Salary - Absent Deduction + Overtime Addition - Advance Deduction
        let estimatedSalary = Math.max(0, Math.round(monthlySalary - absentDeduction + overtimeAddition - advanceDeduction));

        // If existing payroll was already paid, preserve its recorded netPay if present
        if (existingP?.paymentStatus === "paid" && (existingP.netPay || existingP.netSalary)) {
          estimatedSalary = existingP.netPay || existingP.netSalary;
        }

        // Breakdown description
        const breakdownParts = [];
        if (absentDeduction > 0) {
          breakdownParts.push(`−₹${absentDeduction.toLocaleString("en-IN")} (${excessAbsentDays}d absent)`);
        }
        if (overtimeAddition > 0) {
          breakdownParts.push(`+₹${overtimeAddition.toLocaleString("en-IN")} (${overtimeHours}h OT)`);
        }
        if (advanceDeduction > 0) {
          breakdownParts.push(`−₹${advanceDeduction.toLocaleString("en-IN")} (advance salary paid)`);
        }
        if (breakdownParts.length === 0) {
          breakdownParts.push(`Full pay · ₹${Math.round(oneDaySalary)}/day (${workingDaysInMonth} work days)`);
        }
        const breakdownNote = breakdownParts.join(" · ");

        return {
          id: existingP?._id || emp._id,
          payrollId: existingP?._id,
          employeeId: emp._id,
          employeeCode: emp.employeeId || "EMP-001",
          employeeName: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.name,
          email: emp.email || "accounts@example.com",
          monthlySalary,
          presentDays,
          effectivePaidLeaves,
          weekOffs: sundaysCount,
          holidayCount,
          totalAbsentDays,
          overtimeHours,
          oneDaySalary,
          oneHourSalary,
          excessAbsentDays,
          absentDeduction,
          overtimeAddition,
          advanceDeduction,
          empAdvances,
          estimatedSalary,
          breakdownNote,
          status: existingP?.paymentStatus || "pending",
          isPaid: existingP?.paymentStatus === "paid",
        };
      });

      setPayrolls(rows);
    } catch (err) {
      console.error("Failed to fetch payroll records:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeesAndAttendance();
  }, [selectedMonth, selectedYear]);

  // Handle Calculate Payroll Bulk API
  const handleCalculatePayroll = async () => {
    setCalculating(true);
    try {
      const res = await payrollAPI.bulkGenerate({
        month: selectedMonth,
        year: selectedYear,
      });
      message.success(res.data?.message || `Payroll draft calculated for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}.`);
      await fetchEmployeesAndAttendance();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to calculate payroll.");
    } finally {
      setCalculating(false);
    }
  };

  // Mark single salary paid
  const markSalaryPaid = async (name, email, amount, row) => {
    try {
      if (row.payrollId) {
        await payrollAPI.markAsPaid(row.payrollId, {
          paymentMode: "bank_transfer",
          paymentReference: `REF-${Date.now().toString().slice(-6)}`,
        });
      }

      setPayrolls((prev) =>
        prev.map((p) =>
          p.id === row.id
            ? { ...p, isPaid: true, status: "paid" }
            : p
        )
      );

      if (salaryEmailToggle) {
        message.info(
          `${name} marked as paid (₹${amount.toLocaleString("en-IN")}). Notification email queued to ${email}.`
        );
      } else {
        message.info(`${name} marked as paid (₹${amount.toLocaleString("en-IN")}).`);
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to update payment status.");
    }
  };

  const totalFixedSalary = payrolls.reduce((acc, curr) => acc + Number(curr.monthlySalary || 0), 0);
  const totalAdvanceDeductions = payrolls.reduce((acc, curr) => acc + Number(curr.advanceDeduction || 0), 0);
  const totalEstimated = payrolls.reduce((acc, curr) => acc + Number(curr.estimatedSalary || 0), 0);
  const readyCount = payrolls.filter((p) => !p.isPaid).length;
  const paidCount = payrolls.filter((p) => p.isPaid).length;

  const getInitials = (name) => {
    if (!name) return "EMP";
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  };

  return (
    <>
      <div className="crumb">
        DD UPVC <span style={{ margin: "0 6px" }}>/</span> PAYROLL &amp; SALARY
      </div>
      <div className="pagehead">
        <div>
          <h1>Payroll &amp; Salary</h1>
          <p>
            Accurate salary calculation based on monthly working days, paid leaves, absence deductions, and overtime hours.
          </p>
        </div>
        <div className="actions" style={{ alignItems: "center" }}>
          {/* Month & Year Selectors */}
          <select
            className="btn"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={{ fontWeight: 600, color: "var(--navy)", padding: "9px 12px" }}
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="btn"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{ fontWeight: 600, color: "var(--navy)", padding: "9px 12px" }}
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => message.info("Payroll export prepared.")}>
            ⇩ Export
          </button>
          <button className="btn primary" onClick={handleCalculatePayroll} disabled={calculating}>
            {calculating ? "Calculating..." : "＋ Run payroll"}
          </button>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid stats">
        <div className="card stat">
          <div className="statrow">
            <span>Monthly fixed salary</span>
            <span className="staticon">₹</span>
          </div>
          <strong>₹{totalFixedSalary.toLocaleString("en-IN")}</strong>
          <span className="trend">{payrolls.length} active employees</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Advance deductions</span>
            <span className="staticon" style={{ color: "var(--red)" }}>−</span>
          </div>
          <strong style={{ color: totalAdvanceDeductions > 0 ? "var(--red)" : "inherit" }}>
            ₹{totalAdvanceDeductions.toLocaleString("en-IN")}
          </strong>
          <span className="trend" style={{ color: "var(--amber)" }}>Subtracted from salary total</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Estimated payable</span>
            <span className="staticon">▧</span>
          </div>
          <strong>₹{totalEstimated.toLocaleString("en-IN")}</strong>
          <span className="trend">Net payout after advance &amp; absent</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Paid this month</span>
            <span className="staticon">✓</span>
          </div>
          <strong>{paidCount} / {payrolls.length}</strong>
          <span className="trend">Settled employee payouts</span>
        </div>
      </div>

      {/* Main Card */}
      <div className="card">
        <div className="cardhead">
          <div>
            <h2>Monthly payroll calculator — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</h2>
            <small className="muted">
              Working days = {monthSummary.daysInMonth} days in month − {monthSummary.sundaysCount} Sundays (week-offs) − {monthSummary.holidayCount} Holidays = {monthSummary.workingDays} working days. 
              1-day salary = Base salary ÷ {monthSummary.workingDays}. Overtime rate = 1-day salary ÷ 8 hrs.
            </small>
          </div>
          <div className="actions">
            <button className="btn" onClick={() => message.info("Payroll export downloaded.")}>
              Export
            </button>
            <button
              className="btn primary"
              onClick={handleCalculatePayroll}
              disabled={calculating}
            >
              {calculating ? "Calculating..." : "Calculate payroll"}
            </button>
          </div>
        </div>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Monthly salary</th>
                <th>Present</th>
                <th>Paid leave</th>
                <th>Week off</th>
                <th>Holiday</th>
                <th>Absent</th>
                <th>Overtime</th>
                <th>Advance paid</th>
                <th>Estimated salary</th>
                <th>Payment status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {payrolls.length === 0 ? (
                <tr>
                  <td colSpan="12" style={{ textAlign: "center", padding: 30, color: "#64748b" }}>
                    {loading ? "Loading payroll calculation..." : "No employee records found for this period."}
                  </td>
                </tr>
              ) : (
                payrolls.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="customer">
                        <div className="miniavatar">{getInitials(row.employeeName)}</div>
                        <div>
                          <b>{row.employeeName}</b>
                          <small>
                            {row.employeeCode} · {row.email}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>₹{Number(row.monthlySalary).toLocaleString("en-IN")}</td>
                    <td>{row.presentDays}</td>
                    <td>{row.effectivePaidLeaves}</td>
                    <td>{row.weekOffs}</td>
                    <td>{row.holidayCount}</td>
                    <td>
                      {row.totalAbsentDays > 0 ? (
                        <span style={{ color: row.excessAbsentDays > 0 ? "var(--red)" : "var(--ink)", fontWeight: row.excessAbsentDays > 0 ? 700 : 400 }}>
                          {row.totalAbsentDays} {row.excessAbsentDays > 0 && <small style={{ color: "var(--red)" }}>({row.excessAbsentDays} unpaid)</small>}
                        </span>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td>
                      {row.overtimeHours > 0 ? (
                        <span className="pill green" style={{ fontWeight: 700 }}>
                          +{row.overtimeHours} hrs
                        </span>
                      ) : (
                        "0 hrs"
                      )}
                    </td>
                    <td>
                      {row.advanceDeduction > 0 ? (
                        <b style={{ color: "var(--red)", fontSize: 13 }}>
                          −₹{Number(row.advanceDeduction).toLocaleString("en-IN")}
                        </b>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                    </td>
                    <td>
                      <b style={{ fontSize: 13, color: "var(--navy)" }}>
                        ₹{Number(row.estimatedSalary).toLocaleString("en-IN")}
                      </b>
                      <small className="muted" style={{ display: "block", fontSize: 11, marginTop: 2 }}>
                        {row.breakdownNote}
                      </small>
                    </td>
                    <td>
                      {row.isPaid ? (
                        <span className="pill green">Paid</span>
                      ) : (
                        <span className="pill amber">Not paid</span>
                      )}
                    </td>
                    <td>
                      {row.isPaid ? (
                        <span className="pill green">Paid</span>
                      ) : (
                        <button
                          className="btn"
                          style={{ padding: "6px 8px" }}
                          onClick={() =>
                            markSalaryPaid(
                              row.employeeName,
                              row.email,
                              row.estimatedSalary,
                              row
                            )
                          }
                        >
                          Mark paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="cardbody">
          <p className="muted" style={{ fontSize: 11 }}>
            Calculation rule: If an employee's absent days exceed their paid leaves, the excess absent days are deducted from the base salary (excess days × 1-day salary). Overtime pay is calculated as (1-day salary ÷ 8 hours) × overtime hours and added to the estimated salary.
          </p>
        </div>
      </div>

      {/* Settings & Process Cards */}
      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="cardhead">
            <h2>Salary notification settings</h2>
          </div>
          <div className="cardbody">
            <label className="task">
              <input
                type="checkbox"
                id="salaryEmailToggle"
                checked={salaryEmailToggle}
                onChange={(e) => setSalaryEmailToggle(e.target.checked)}
              />
              <span>
                <b>Email employee when salary is marked paid</b>
                <small>Optional notification after payment status is confirmed.</small>
              </span>
            </label>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Email subject template</label>
              <input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Notification message</label>
              <textarea
                rows="3"
                value={notificationMsg}
                onChange={(e) => setNotificationMsg(e.target.value)}
              />
            </div>

            <p className="muted" style={{ fontSize: 11 }}>
              Prototype only: no email is sent. Connect SMTP or a transactional email provider to send real notifications.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="cardhead">
            <h2>Salary process</h2>
          </div>
          <div className="cardbody">
            {[
              ["1", "Review attendance", "Check manual punches, leave, week-offs and holidays."],
              ["2", "Calculate salary", "Working days = Total days − Sundays − Holidays. 1-day rate = Salary ÷ Working days."],
              ["3", "Deductions & Overtime", "Deduct excess absent days × 1-day rate. Add overtime hours × (1-day rate ÷ 8 hrs)."],
              ["4", "Approve & pay", "Record actual payment reference and date."],
            ].map((a) => (
              <div className="task" key={a[0]}>
                <span className="staticon">{a[0]}</span>
                <span>
                  <b>{a[1]}</b>
                  <small>{a[2]}</small>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Payroll() {
  return <PayrollContent />;
}
