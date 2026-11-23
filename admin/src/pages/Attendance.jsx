import React, { useState, useEffect, useCallback } from "react";
import { App } from "antd";
import dayjs from "dayjs";
import { attendanceAPI, employeeAPI, holidayAPI } from "../services/api";

function statusPill(s) {
  const x = (s || "").toLowerCase();
  let c = /present|active|ready|completed/.test(x)
    ? "green"
    : /absent|rejected/.test(x)
    ? "red"
    : /leave|on-leave|paid-leave|holiday|week-off|half-day|weekend/.test(x)
    ? "amber"
    : "blue";
  return <span className={`pill ${c}`}>{s}</span>;
}

export default function Attendance() {
  const { message } = App.useApp();
  const [activeTab, setActiveTab] = useState("daily"); // "daily" | "bulk" | "holidays"
  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All day statuses");

  // Historical employee attendance summary range
  const [historyRange, setHistoryRange] = useState("daily"); // "daily" | "30" | "60" | "90" | "lifetime"
  const [historySummary, setHistorySummary] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Bulk Attendance State
  const [bulkRoster, setBulkRoster] = useState({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [savingRowId, setSavingRowId] = useState(null);

  // Manual Attendance Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [modalForm, setModalForm] = useState({
    employeeQuery: "",
    attendanceDate: dayjs().format("YYYY-MM-DD"),
    dayStatus: "Present",
    manualCheckInTime: "09:00",
    manualCheckOutTime: "18:00",
    overtimeHours: 0,
    adminNotes: "",
  });

  // Holiday Modal
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    name: "",
    date: dayjs().format("YYYY-MM-DD"),
    description: "",
  });
  const [holidaySaving, setHolidaySaving] = useState(false);

  // Fetch employees
  const loadEmployees = async () => {
    try {
      const res = await employeeAPI.list({ limit: 100, status: "active" });
      const list = res.data?.employees || res.data?.data?.employees || [];
      setEmployees(list);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch holidays
  const loadHolidays = async () => {
    try {
      const res = await holidayAPI.list();
      setHolidays(res.data?.holidays || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch attendance records for selected date
  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceAPI.list({
        startDate: selectedDate,
        endDate: selectedDate,
        limit: 100,
      });
      const data = res.data?.attendance || res.data?.data?.attendance || [];
      setRecords(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadEmployees();
    loadHolidays();
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  // Load Historical Summary when 30/60/90/lifetime is selected
  useEffect(() => {
    if (historyRange === "daily") {
      setHistorySummary({});
      return;
    }

    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        let startDate = null;
        const endDate = dayjs().format("YYYY-MM-DD");

        if (historyRange === "30") {
          startDate = dayjs().subtract(30, "day").format("YYYY-MM-DD");
        } else if (historyRange === "60") {
          startDate = dayjs().subtract(60, "day").format("YYYY-MM-DD");
        } else if (historyRange === "90") {
          startDate = dayjs().subtract(90, "day").format("YYYY-MM-DD");
        } else if (historyRange === "lifetime") {
          startDate = "2020-01-01"; // Early threshold to cover all joining dates
        }

        const res = await attendanceAPI.list({
          startDate,
          endDate,
          limit: 1000,
        });

        const historyRecords = res.data?.attendance || res.data?.data?.attendance || [];

        // Aggregate by employee
        const agg = {};
        employees.forEach((emp) => {
          agg[emp._id] = {
            present: 0,
            absent: 0,
            halfDay: 0,
            leave: 0,
            weekOff: 0,
            holiday: 0,
            overtimeDays: 0,
            overtimeHours: 0,
            totalRecords: 0,
          };
        });

        historyRecords.forEach((r) => {
          const empId = r.employee?._id || r.employee;
          if (agg[empId]) {
            const st = (r.status || "").toLowerCase();
            agg[empId].totalRecords++;
            if (st === "present" || st === "late") agg[empId].present++;
            else if (st === "absent") agg[empId].absent++;
            else if (st === "half-day") agg[empId].halfDay++;
            else if (st.includes("leave")) agg[empId].leave++;
            else if (st.includes("week-off") || st.includes("weekend")) agg[empId].weekOff++;
            else if (st.includes("holiday")) agg[empId].holiday++;

            if (r.overtimeHours && Number(r.overtimeHours) > 0) {
              agg[empId].overtimeHours += Number(r.overtimeHours);
              agg[empId].overtimeDays += 1;
            }
          }
        });

        setHistorySummary(agg);
      } catch (err) {
        console.error("Failed to load historical attendance", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    if (employees.length > 0) {
      fetchHistory();
    }
  }, [historyRange, employees]);

  const isSunday = dayjs(selectedDate).day() === 0;
  const currentHoliday = holidays.find(
    (h) => dayjs(h.date).format("YYYY-MM-DD") === selectedDate
  );

  // Sync bulk roster when employees or records load
  useEffect(() => {
    const roster = {};
    employees.forEach((emp) => {
      const existing = records.find(
        (r) =>
          ((r.employee?._id || r.employee) === emp._id ||
          r.employeeId === emp.employeeId) &&
          dayjs(r.date).format("YYYY-MM-DD") === selectedDate
      );

      let defaultStatus = "present";
      if (currentHoliday) defaultStatus = "holiday";
      else if (isSunday) defaultStatus = "week-off";

      roster[emp._id] = {
        status: existing?.status || defaultStatus,
        checkIn: existing?.checkIn
          ? dayjs(existing.checkIn).format("HH:mm")
          : existing?.checkInTime || "09:00",
        checkOut: existing?.checkOut
          ? dayjs(existing.checkOut).format("HH:mm")
          : existing?.checkOutTime || "18:00",
        overtimeHours: existing?.overtimeHours || 0,
        notes: existing?.notes || "",
        recordId: existing?._id,
      };
    });
    setBulkRoster(roster);
  }, [employees, records, selectedDate, currentHoliday, isSunday]);

  // Table Data
  const tableData = employees.map((emp) => {
    const existing = records.find(
      (r) =>
        (r.employee?._id || r.employee) === emp._id ||
        r.employeeId === emp.employeeId
    );

    let defaultStatus = "Absent";
    if (currentHoliday) defaultStatus = "Public holiday";
    else if (isSunday) defaultStatus = "Week off";

    const status = existing?.status || defaultStatus;
    const checkIn = existing?.checkIn
      ? dayjs(existing.checkIn).format("hh:mm A")
      : existing?.checkInTime || "—";
    const checkOut = existing?.checkOut
      ? dayjs(existing.checkOut).format("hh:mm A")
      : existing?.checkOutTime || "—";

    const summary = historySummary[emp._id] || {
      present: 0,
      absent: 0,
      halfDay: 0,
      leave: 0,
      weekOff: 0,
      holiday: 0,
      overtimeDays: 0,
      overtimeHours: 0,
      totalRecords: 0,
    };

    // Calculate total calendar days in the selected range for this employee
    let totalRangeDays = 30;
    if (historyRange === "30") totalRangeDays = 30;
    else if (historyRange === "60") totalRangeDays = 60;
    else if (historyRange === "90") totalRangeDays = 90;
    else if (historyRange === "lifetime") {
      const join = emp.joinDate ? dayjs(emp.joinDate) : dayjs().subtract(30, "day");
      totalRangeDays = Math.max(1, dayjs().diff(join, "day") + 1);
    }

    return {
      empId: emp._id,
      employeeCode: emp.employeeId,
      name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.name,
      department: emp.department || "General",
      joiningDate: emp.joinDate ? dayjs(emp.joinDate).format("DD MMM YYYY") : "—",
      status: status.charAt(0).toUpperCase() + status.slice(1).replace("-", " "),
      rawStatus: existing?.status || defaultStatus,
      checkIn,
      checkOut,
      overtimeHours: existing?.overtimeHours || 0,
      adminNotes: existing?.notes || existing?.adminNotes || "",
      recordId: existing?._id,
      summary,
      totalRangeDays,
    };
  });

  const filteredData = tableData.filter((row) => {
    const matchesSearch =
      row.name.toLowerCase().includes(search.toLowerCase()) ||
      (row.employeeCode || "").toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filterStatus === "All day statuses") return true;
    return row.status.toLowerCase().includes(filterStatus.toLowerCase());
  });

  // Open modal for manual add/edit
  const openAddModal = (row = null) => {
    if (row) {
      setEditingId(row.recordId || null);
      setModalForm({
        employeeQuery: row.name || row.employeeCode,
        attendanceDate: selectedDate,
        dayStatus: row.status || "Present",
        manualCheckInTime: row.checkIn !== "—" ? row.checkIn : "09:00",
        manualCheckOutTime: row.checkOut !== "—" ? row.checkOut : "18:00",
        overtimeHours: row.overtimeHours || 0,
        adminNotes: row.adminNotes || "",
      });
    } else {
      setEditingId(null);
      setModalForm({
        employeeQuery: employees[0]?.name || "",
        attendanceDate: selectedDate,
        dayStatus: currentHoliday ? "Public holiday" : isSunday ? "Week off" : "Present",
        manualCheckInTime: "09:00",
        manualCheckOutTime: "18:00",
        overtimeHours: 0,
        adminNotes: "",
      });
    }
    setModalOpen(true);
  };

  const handleSaveModal = async () => {
    try {
      const emp = employees.find(
        (e) =>
          `${e.firstName || ""} ${e.lastName || ""}`.trim() === modalForm.employeeQuery ||
          e.name === modalForm.employeeQuery ||
          e.employeeId === modalForm.employeeQuery
      ) || employees[0];

      if (!emp) {
        message.error("Please select a valid employee.");
        return;
      }

      const statusFormatted = modalForm.dayStatus.toLowerCase().replace(/\s+/g, "-");

      const payload = {
        employee: emp._id,
        employeeId: emp.employeeId,
        date: modalForm.attendanceDate,
        status: statusFormatted,
        checkInTime: modalForm.manualCheckInTime,
        checkOutTime: modalForm.manualCheckOutTime,
        overtimeHours: Number(modalForm.overtimeHours) || 0,
        notes: modalForm.adminNotes,
      };

      if (editingId) {
        await attendanceAPI.update(editingId, payload);
        message.success("Attendance updated successfully.");
      } else {
        await attendanceAPI.mark(payload);
        message.success("Attendance saved successfully.");
      }

      setModalOpen(false);
      loadAttendance();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to save attendance.");
    }
  };

  // Bulk Save Single Row
  const handleSaveSingleRow = async (emp) => {
    setSavingRowId(emp._id);
    const row = bulkRoster[emp._id] || {};
    try {
      const payload = {
        employee: emp._id,
        employeeId: emp.employeeId,
        date: selectedDate,
        status: row.status || "present",
        checkInTime: row.checkIn || "09:00",
        checkOutTime: row.checkOut || "18:00",
        overtimeHours: Number(row.overtimeHours) || 0,
        notes: row.notes || "",
      };

      if (row.recordId) {
        await attendanceAPI.update(row.recordId, payload);
      } else {
        await attendanceAPI.mark(payload);
      }
      message.success(`Saved attendance for ${emp.firstName || emp.name}`);
      await loadAttendance();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to save entry");
    } finally {
      setSavingRowId(null);
    }
  };

  // Bulk Save All Employees
  const handleSaveAllBulk = async () => {
    setBulkSaving(true);
    try {
      const records = employees.map((emp) => {
        const row = bulkRoster[emp._id] || {};
        return {
          employee: emp._id,
          employeeId: emp.employeeId,
          status: row.status || "present",
          checkIn: row.checkIn ? `${selectedDate}T${row.checkIn}:00` : undefined,
          checkOut: row.checkOut ? `${selectedDate}T${row.checkOut}:00` : undefined,
          overtimeHours: Number(row.overtimeHours) || 0,
          notes: row.notes || "",
        };
      });

      await attendanceAPI.bulkMark({
        date: selectedDate,
        records,
      });
      message.success("All attendance records saved successfully!");
      await loadAttendance();
    } catch (err) {
      message.error(err.response?.data?.message || "Bulk save failed.");
    } finally {
      setBulkSaving(false);
    }
  };

  // Save New Holiday
  const handleCreateHoliday = async () => {
    if (!holidayForm.name.trim() || !holidayForm.date) {
      message.error("Holiday name and date are required.");
      return;
    }
    setHolidaySaving(true);
    try {
      await holidayAPI.create(holidayForm);
      message.success("Holiday added successfully.");
      setHolidayModalOpen(false);
      setHolidayForm({ name: "", date: dayjs().format("YYYY-MM-DD"), description: "" });
      loadHolidays();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to add holiday.");
    } finally {
      setHolidaySaving(false);
    }
  };

  // Delete Holiday
  const handleDeleteHoliday = async (id) => {
    try {
      await holidayAPI.delete(id);
      message.success("Holiday removed.");
      loadHolidays();
    } catch (err) {
      message.error("Failed to delete holiday.");
    }
  };

  // Mark all bulk present or other status
  const handleMarkAllBulk = (targetStatus) => {
    const updated = { ...bulkRoster };
    employees.forEach((emp) => {
      const isPresent = targetStatus === "present";
      updated[emp._id] = {
        ...(updated[emp._id] || {}),
        status: targetStatus,
        checkIn: isPresent ? "09:00" : (targetStatus === "absent" ? "" : (updated[emp._id]?.checkIn || "09:00")),
        checkOut: isPresent ? "18:00" : (targetStatus === "absent" ? "" : (updated[emp._id]?.checkOut || "18:00")),
      };
    });
    setBulkRoster(updated);
    message.info(`Set all employees to ${targetStatus} (09:00 - 18:00)`);
  };

  // Stats calculation
  const presentCount = tableData.filter((r) =>
    ["Present", "Late", "Half day"].includes(r.status)
  ).length;
  const absentCount = tableData.filter((r) => r.status === "Absent").length;
  const leaveCount = tableData.filter((r) =>
    ["Paid leave", "Unpaid leave", "Leave", "On leave"].includes(r.status)
  ).length;

  return (
    <>
      <div className="crumb">
        DD UPVC <span style={{ margin: "0 6px" }}>/</span> ATTENDANCE & LEAVE
      </div>
      <div className="pagehead">
        <div>
          <h1>Attendance & Leave</h1>
          <p>Clock-in/out, shifts, leave requests, overtime, bulk attendance and holiday calendar.</p>
        </div>
        <div className="actions">
          <button
            className={`btn ${activeTab === "daily" ? "primary" : ""}`}
            onClick={() => setActiveTab("daily")}
          >
            Daily Register
          </button>
          <button
            className={`btn ${activeTab === "bulk" ? "primary" : ""}`}
            onClick={() => setActiveTab("bulk")}
          >
            ⚡ Bulk Attendance
          </button>
          <button
            className={`btn ${activeTab === "holidays" ? "primary" : ""}`}
            onClick={() => setActiveTab("holidays")}
          >
            📅 Holidays & Week-offs ({holidays.length})
          </button>
          <button className="btn" onClick={() => openAddModal()}>
            ＋ Add manual attendance
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid stats">
        <div className="card stat">
          <div className="statrow">
            <span>Present today</span>
            <span className="staticon">✓</span>
          </div>
          <strong>{presentCount}</strong>
          <span className="trend">Daily attendance count</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Absent</span>
            <span className="staticon">!</span>
          </div>
          <strong>{absentCount}</strong>
          <span className="trend">Needs review</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>On leave</span>
            <span className="staticon">◷</span>
          </div>
          <strong>{leaveCount}</strong>
          <span className="trend">Approved leave</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Calendar rule</span>
            <span className="staticon">▦</span>
          </div>
          <strong>{currentHoliday ? currentHoliday.name : isSunday ? "Sunday (Week Off)" : "Working Day"}</strong>
          <span className="trend">Automated holiday logic</span>
        </div>
      </div>

      {/* TAB 1: DAILY REGISTER */}
      {activeTab === "daily" && (
        <div className="card">
          <div className="cardhead">
            <div>
              <h2>Manual attendance register</h2>
              <small className="muted">
                Admin can record or correct check-in/out times, overtime, and day status.
              </small>
            </div>
            <div className="actions" style={{ alignItems: "center" }}>
              {/* Employee Attendance Range Dropdown Option */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)" }}>Employee attendance:</span>
                <select
                  className="btn"
                  style={{ fontWeight: 600, color: "var(--navy)", padding: "7px 10px" }}
                  value={historyRange}
                  onChange={(e) => setHistoryRange(e.target.value)}
                >
                  <option value="daily">Single Day View</option>
                  <option value="30">Previous 30 Days</option>
                  <option value="60">Previous 60 Days</option>
                  <option value="90">Previous 90 Days</option>
                  <option value="lifetime">Lifetime (Joining to Present)</option>
                </select>
              </div>

              <button className="btn primary" onClick={() => openAddModal()}>
                ＋ Add attendance
              </button>
            </div>
          </div>

          <div className="toolbar" style={{ padding: "14px 16px 0", marginBottom: 0 }}>
            {historyRange === "daily" ? (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            ) : (
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--blue)" }}>
                📊 Aggregating {historyRange === "lifetime" ? "Lifetime Attendance" : `Previous ${historyRange} Days`}
              </div>
            )}
            <input
              placeholder="Search employee…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {historyRange === "daily" && (
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option>All day statuses</option>
                <option>Present</option>
                <option>Absent</option>
                <option>Week off</option>
                <option>Holiday</option>
                <option>Leave</option>
                <option>Half day</option>
              </select>
            )}
            <button className="btn" onClick={() => message.info("Exporting attendance register...")}>
              Export register
            </button>
          </div>

          <div className="tablewrap">
            {historyRange === "daily" ? (
              /* Single Date View Table */
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Day status</th>
                    <th>Overtime (hrs)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.length > 0 ? (
                    filteredData.map((r, i) => (
                      <tr key={r.empId || i}>
                        <td>
                          <b>{dayjs(selectedDate).format("DD MMM YYYY")}</b>
                        </td>
                        <td>
                          <div className="customer">
                            <div className="miniavatar">
                              {(r.name || "U")
                                .split(" ")
                                .map((w) => w[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()}
                            </div>
                            <div>
                              <b>{r.name}</b>
                              <small>{r.employeeCode || r.department}</small>
                            </div>
                          </div>
                        </td>
                        <td>{r.checkIn}</td>
                        <td>{r.checkOut}</td>
                        <td>{statusPill(r.status)}</td>
                        <td>
                          {r.overtimeHours > 0 ? (
                            <b style={{ color: "var(--blue)" }}>+{r.overtimeHours} hrs</b>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <button
                            className="btn"
                            style={{ padding: "6px 9px" }}
                            onClick={() => openAddModal(r)}
                          >
                            Edit ↗
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7">
                        <div className="emptyhint">
                          <b>No matching records</b>
                          {loading ? "Loading attendance..." : "No attendance found for this date."}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              /* Historical Summary View Table (30 / 60 / 90 / Lifetime) */
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Joining Date</th>
                    <th>Present Days</th>
                    <th>Absent Days</th>
                    <th>Half Days</th>
                    <th>Leaves</th>
                    <th>Week Offs</th>
                    <th>Holidays</th>
                    <th>Overtime (Days)</th>
                    <th>Overtime (Hrs)</th>
                    <th>Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingHistory ? (
                    <tr>
                      <td colSpan="11" style={{ textAlign: "center", padding: 25, color: "var(--muted)" }}>
                        Calculating {historyRange === "lifetime" ? "lifetime" : `${historyRange} days`} attendance summary...
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((r) => {
                      const s = r.summary;
                      const totalDays = r.totalRangeDays || 30;

                      // Actual recorded absent days + untracked days within the range count as absent
                      const recordedDays = s.present + s.halfDay + s.leave + s.weekOff + s.holiday + s.absent;
                      const unrecordedAbsent = Math.max(0, totalDays - recordedDays);
                      const totalAbsent = s.absent + unrecordedAbsent;

                      // Dynamic Attendance % based on valid working days
                      const effectivePresent = s.present + s.halfDay * 0.5;
                      const workingDays = Math.max(1, totalDays - s.weekOff - s.holiday);
                      const pct = Math.min(100, Math.max(0, Math.round((effectivePresent / workingDays) * 100)));

                      return (
                        <tr key={r.empId}>
                          <td>
                            <div className="customer">
                              <div className="miniavatar">
                                {(r.name || "U")[0].toUpperCase()}
                              </div>
                              <div>
                                <b>{r.name}</b>
                                <small>{r.employeeCode} · {r.department}</small>
                              </div>
                            </div>
                          </td>
                          <td>{r.joiningDate}</td>
                          <td>
                            <b style={{ color: "var(--green)" }}>{s.present}</b>
                            <span className="muted" style={{ fontSize: 11, marginLeft: 4 }}>
                              / {totalDays} days
                            </span>
                          </td>
                          <td>
                            <b style={{ color: totalAbsent > 0 ? "var(--red)" : "inherit" }}>
                              {totalAbsent}
                            </b>
                            <span className="muted" style={{ fontSize: 11, marginLeft: 4 }}>
                              / {totalDays} days
                            </span>
                          </td>
                          <td>{s.halfDay}</td>
                          <td>{s.leave}</td>
                          <td>{s.weekOff}</td>
                          <td>{s.holiday}</td>
                          <td>
                            {s.overtimeDays > 0 ? (
                              <b style={{ color: "var(--blue)" }}>{s.overtimeDays} days</b>
                            ) : (
                              "0 days"
                            )}
                          </td>
                          <td>
                            {s.overtimeHours > 0 ? (
                              <b style={{ color: "var(--blue)" }}>+{s.overtimeHours} hrs</b>
                            ) : (
                              "0 hrs"
                            )}
                          </td>
                          <td>
                            <span className={`pill ${pct >= 75 ? "green" : pct >= 50 ? "amber" : "red"}`}>
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ padding: "12px 16px", color: "#8390a2", fontSize: 11, borderTop: "1px solid var(--line)" }}>
            Showing {filteredData.length} records · {historyRange === "daily" ? `Daily Date: ${selectedDate}` : `Range: ${historyRange === "lifetime" ? "Lifetime (Since Joining)" : `Past ${historyRange} Days`}`}
          </div>
        </div>
      )}

      {/* TAB 2: BULK ATTENDANCE ROSTER */}
      {activeTab === "bulk" && (
        <div className="card">
          <div className="cardhead">
            <div>
              <h2>Bulk Attendance Entry</h2>
              <small className="muted">
                Mark, modify, and save check-in/out times and statuses for all employees at once.
              </small>
            </div>
            <div className="actions">
              <button className="btn" onClick={() => handleMarkAllBulk("present")}>
                Mark All Present
              </button>
              <button className="btn" onClick={() => handleMarkAllBulk("absent")}>
                Mark All Absent
              </button>
              <button
                className="btn primary"
                onClick={handleSaveAllBulk}
                disabled={bulkSaving}
              >
                {bulkSaving ? "Saving All..." : "💾 Save All Roster"}
              </button>
            </div>
          </div>

          <div className="toolbar" style={{ padding: "14px 16px 0", marginBottom: 0 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Select Roster Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Status</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Overtime (hrs)</th>
                  <th>Notes</th>
                  <th>Save Row</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const entry = bulkRoster[emp._id] || {};
                  const isSavingThis = savingRowId === emp._id;
                  return (
                    <tr key={emp._id}>
                      <td>
                        <div className="customer">
                          <div className="miniavatar">
                            {(emp.firstName || emp.name || "E")[0].toUpperCase()}
                          </div>
                          <div>
                            <b>{emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim()}</b>
                            <small>{emp.employeeId || emp.department}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <select
                          value={entry.status || "present"}
                          onChange={(e) => {
                            setBulkRoster({
                              ...bulkRoster,
                              [emp._id]: { ...entry, status: e.target.value },
                            });
                          }}
                        >
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="half-day">Half day</option>
                          <option value="paid-leave">Paid leave</option>
                          <option value="unpaid-leave">Unpaid leave</option>
                          <option value="week-off">Week off</option>
                          <option value="holiday">Holiday</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="time"
                          value={entry.checkIn || "09:00"}
                          onChange={(e) => {
                            setBulkRoster({
                              ...bulkRoster,
                              [emp._id]: { ...entry, checkIn: e.target.value },
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          value={entry.checkOut || "18:00"}
                          onChange={(e) => {
                            setBulkRoster({
                              ...bulkRoster,
                              [emp._id]: { ...entry, checkOut: e.target.value },
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          style={{ width: 70 }}
                          value={entry.overtimeHours || 0}
                          onChange={(e) => {
                            setBulkRoster({
                              ...bulkRoster,
                              [emp._id]: { ...entry, overtimeHours: e.target.value },
                            });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          placeholder="Optional notes"
                          value={entry.notes || ""}
                          onChange={(e) => {
                            setBulkRoster({
                              ...bulkRoster,
                              [emp._id]: { ...entry, notes: e.target.value },
                            });
                          }}
                        />
                      </td>
                      <td>
                        <button
                          className="btn primary"
                          style={{ padding: "6px 12px" }}
                          disabled={isSavingThis}
                          onClick={() => handleSaveSingleRow(emp)}
                        >
                          {isSavingThis ? "Saving..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: HOLIDAY MANAGEMENT */}
      {activeTab === "holidays" && (
        <div className="card">
          <div className="cardhead">
            <div>
              <h2>Official Company Holidays &amp; Week-offs</h2>
              <small className="muted">
                Employees are automatically not marked absent on these days. Overtime can still be added.
              </small>
            </div>
            <button className="btn primary" onClick={() => setHolidayModalOpen(true)}>
              ＋ Add Holiday
            </button>
          </div>

          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Holiday Name</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {holidays.length > 0 ? (
                  holidays.map((h) => (
                    <tr key={h._id}>
                      <td>
                        <b>{h.name}</b>
                      </td>
                      <td>{dayjs(h.date).format("DD MMMM YYYY (dddd)")}</td>
                      <td>{h.description || "Public Holiday"}</td>
                      <td>
                        <button
                          className="btn"
                          style={{ color: "var(--red)", borderColor: "var(--red)" }}
                          onClick={() => handleDeleteHoliday(h._id)}
                        >
                          Delete ✕
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4">
                      <div className="emptyhint">
                        <b>No official holidays added</b>
                        Click '+ Add Holiday' to add company or national holidays.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}



      {/* Manual Attendance Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="cardhead">
              <h2 id="modalTitle">
                {editingId ? "Edit manual attendance" : "Add manual attendance"}
              </h2>
              <button className="btn" id="closeModal" onClick={() => setModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="cardbody" id="modalBody">
              <div className="formgrid">
                <div className="field">
                  <label>Employee name / ID</label>
                  <select
                    value={modalForm.employeeQuery}
                    onChange={(e) => setModalForm({ ...modalForm, employeeQuery: e.target.value })}
                  >
                    {employees.map((emp) => (
                      <option
                        key={emp._id}
                        value={`${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.name}
                      >
                        {`${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.name} ({emp.employeeId || "No ID"})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Attendance date</label>
                  <input
                    type="date"
                    placeholder="Attendance date"
                    value={modalForm.attendanceDate}
                    onChange={(e) => setModalForm({ ...modalForm, attendanceDate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Day status</label>
                  <select
                    value={modalForm.dayStatus}
                    onChange={(e) => setModalForm({ ...modalForm, dayStatus: e.target.value })}
                  >
                    <option>Select option</option>
                    <option>Present</option>
                    <option>Absent</option>
                    <option>Half day</option>
                    <option>Paid leave</option>
                    <option>Unpaid leave</option>
                    <option>Week off</option>
                    <option>Public holiday</option>
                  </select>
                </div>
                <div className="field">
                  <label>Manual check-in time</label>
                  <input
                    type="time"
                    placeholder="Manual check-in time"
                    value={modalForm.manualCheckInTime}
                    onChange={(e) => setModalForm({ ...modalForm, manualCheckInTime: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Manual check-out time</label>
                  <input
                    type="time"
                    placeholder="Manual check-out time"
                    value={modalForm.manualCheckOutTime}
                    onChange={(e) => setModalForm({ ...modalForm, manualCheckOutTime: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Overtime hours</label>
                  <input
                    type="number"
                    placeholder="Overtime hours"
                    min="0"
                    value={modalForm.overtimeHours}
                    onChange={(e) => setModalForm({ ...modalForm, overtimeHours: e.target.value })}
                  />
                </div>
                <div className="field full">
                  <label>Admin notes</label>
                  <input
                    type="text"
                    placeholder="Admin notes"
                    value={modalForm.adminNotes}
                    onChange={(e) => setModalForm({ ...modalForm, adminNotes: e.target.value })}
                  />
                </div>
              </div>
              <p className="muted" style={{ fontSize: 11, marginTop: 16 }}>
                Sunday is configured as week off. On public holidays attendance is not charged unless overtime is marked.
              </p>
            </div>
            <div className="modalfoot">
              <button className="btn" id="cancelModal" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className="btn primary" id="saveModal" onClick={handleSaveModal}>
                Save draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Holiday Modal */}
      {holidayModalOpen && (
        <div className="modal-overlay" onClick={() => setHolidayModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="cardhead">
              <h2>Add Company Holiday</h2>
              <button className="btn" onClick={() => setHolidayModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="cardbody">
              <div className="formgrid">
                <div className="field">
                  <label>Holiday Name *</label>
                  <input
                    value={holidayForm.name}
                    onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                    placeholder="e.g. Diwali, Independence Day"
                  />
                </div>
                <div className="field">
                  <label>Holiday Date *</label>
                  <input
                    type="date"
                    value={holidayForm.date}
                    onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                  />
                </div>
                <div className="field full">
                  <label>Description (Optional)</label>
                  <input
                    value={holidayForm.description}
                    onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                    placeholder="e.g. National public holiday"
                  />
                </div>
              </div>
            </div>
            <div className="modalfoot">
              <button className="btn" onClick={() => setHolidayModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={holidaySaving}
                onClick={handleCreateHoliday}
              >
                {holidaySaving ? "Saving..." : "Add Holiday"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
