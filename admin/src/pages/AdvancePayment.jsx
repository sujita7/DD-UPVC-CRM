import React, { useState, useEffect, useCallback } from "react";
import { App } from "antd";
import dayjs from "dayjs";
import { advancePaymentAPI, employeeAPI } from "../services/api";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const PAYMENT_METHODS = [
  "Cash",
  "UPI / GPay / PhonePe",
  "Bank Transfer / NEFT",
  "Cheque",
];

function statusPill(status) {
  const s = (status || "").toLowerCase();
  if (s === "deducted") {
    return <span className="pill green">✓ Deducted in Payroll</span>;
  }
  return <span className="pill amber">◷ Pending Deduction</span>;
}

export default function AdvancePayment() {
  const { message, modal } = App.useApp();
  const currentYear = dayjs().year();
  const currentMonth = dayjs().month() + 1;

  const [advances, setAdvances] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({
    totalAmount: 0,
    pendingAmount: 0,
    deductedAmount: 0,
    count: 0,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState(null);

  const [form, setForm] = useState({
    employee: "",
    amount: "",
    paymentDate: dayjs().format("YYYY-MM-DD"),
    month: currentMonth,
    year: currentYear,
    paymentMethod: "Cash",
    notes: "",
    status: "pending",
  });

  const fetchEmployees = async () => {
    try {
      const res = await employeeAPI.list({ limit: 100, status: "active" });
      setEmployees(res.data?.employees || res.data?.data?.employees || []);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    }
  };

  const fetchAdvances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await advancePaymentAPI.list({
        search: search.trim() || undefined,
        status: statusFilter !== "All" ? statusFilter : undefined,
        month: selectedMonth !== "All" ? selectedMonth : undefined,
        year: selectedYear !== "All" ? selectedYear : undefined,
      });

      setAdvances(res.data?.advances || []);
      if (res.data?.stats) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch advance payments:", err);
      message.error("Failed to load advance payment records.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchAdvances();
  }, [fetchAdvances]);

  const handleOpenCreateModal = () => {
    setEditingAdvance(null);
    setForm({
      employee: employees[0]?._id || employees[0]?.id || "",
      amount: "",
      paymentDate: dayjs().format("YYYY-MM-DD"),
      month: currentMonth,
      year: currentYear,
      paymentMethod: "Cash",
      notes: "",
      status: "pending",
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (adv) => {
    setEditingAdvance(adv);
    const empId = adv.employee?._id || adv.employee?.id || adv.employee || "";
    setForm({
      employee: empId,
      amount: adv.amount !== undefined ? adv.amount : "",
      paymentDate: adv.paymentDate ? dayjs(adv.paymentDate).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
      month: adv.month || currentMonth,
      year: adv.year || currentYear,
      paymentMethod: adv.paymentMethod || "Cash",
      notes: adv.notes || "",
      status: adv.status || "pending",
    });
    setShowModal(true);
  };

  const handleSaveAdvance = async () => {
    if (!form.employee) {
      message.error("Please select an employee.");
      return;
    }

    if (form.amount === "" || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      message.error("Please enter a valid advance payment amount (greater than 0).");
      return;
    }

    if (!form.paymentDate) {
      message.error("Please select the date when advance money was given.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        employee: form.employee,
        amount: Number(form.amount),
        paymentDate: form.paymentDate,
        month: Number(form.month),
        year: Number(form.year),
        paymentMethod: form.paymentMethod,
        notes: form.notes ? form.notes.trim() : "",
        status: form.status,
      };

      if (editingAdvance) {
        await advancePaymentAPI.update(editingAdvance._id || editingAdvance.id, payload);
        message.success("Advance payment updated successfully!");
      } else {
        await advancePaymentAPI.create(payload);
        message.success("Advance payment recorded successfully!");
      }

      setShowModal(false);
      fetchAdvances();
    } catch (err) {
      console.error("Error saving advance payment:", err);
      message.error(err.response?.data?.message || "Failed to save advance payment.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAdvance = (adv) => {
    modal.confirm({
      title: "Delete Advance Payment Record?",
      content: `Are you sure you want to delete advance payment of ₹${Number(adv.amount || 0).toLocaleString("en-IN")} given to ${adv.employeeName || "Employee"}? This amount will no longer be subtracted from payroll.`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await advancePaymentAPI.delete(adv._id || adv.id);
          message.success("Advance payment record deleted successfully.");
          fetchAdvances();
        } catch (err) {
          message.error(err.response?.data?.message || "Failed to delete advance payment.");
        }
      },
    });
  };

  const getInitials = (name) => {
    if (!name) return "EMP";
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  };

  // Find selected employee details in modal
  const selectedEmpObj = employees.find((e) => (e._id || e.id) === form.employee);
  const selectedEmpSalary = Number(
    selectedEmpObj?.salary?.basic ||
    selectedEmpObj?.salary?.grossSalary ||
    selectedEmpObj?.baseSalary ||
    0
  );

  return (
    <>
      <div className="crumb">
        DD UPVC <span style={{ margin: "0 6px" }}>/</span> ADVANCE SALARY PAYMENTS
      </div>

      <div className="pagehead">
        <div>
          <h1>Employee Advance Payments</h1>
          <p>Record advance money given to employees. All recorded advance amounts are automatically subtracted from payroll salary totals.</p>
        </div>
        <div className="actions">
          <button
            className="btn primary"
            onClick={handleOpenCreateModal}
            style={{ background: "#103567", borderColor: "#103567", fontWeight: 600 }}
          >
            ＋ Add Advance Payment
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid stats">
        <div className="card stat">
          <div className="statrow">
            <span>Total Advances Given</span>
            <span className="staticon">₹</span>
          </div>
          <strong>₹{stats.totalAmount.toLocaleString("en-IN")}</strong>
          <span className="trend">{stats.count} advance disbursements</span>
        </div>

        <div className="card stat">
          <div className="statrow">
            <span>Pending Salary Deduction</span>
            <span className="staticon" style={{ color: "var(--red)" }}>−</span>
          </div>
          <strong style={{ color: stats.pendingAmount > 0 ? "var(--red)" : "inherit" }}>
            ₹{stats.pendingAmount.toLocaleString("en-IN")}
          </strong>
          <span className="trend" style={{ color: "var(--amber)" }}>To subtract in upcoming payroll</span>
        </div>

        <div className="card stat">
          <div className="statrow">
            <span>Deducted in Payroll</span>
            <span className="staticon" style={{ color: "var(--green)" }}>✓</span>
          </div>
          <strong style={{ color: "var(--green)" }}>
            ₹{stats.deductedAmount.toLocaleString("en-IN")}
          </strong>
          <span className="trend" style={{ color: "var(--green)" }}>Recovered from employee payout</span>
        </div>

        <div className="card stat">
          <div className="statrow">
            <span>Active Advance Records</span>
            <span className="staticon">♧</span>
          </div>
          <strong>{advances.filter((a) => a.status !== "deducted").length}</strong>
          <span className="trend">Pending reconciliation</span>
        </div>
      </div>

      {/* Advance Payments Table Card */}
      <div className="card">
        <div className="cardhead">
          <h2>
            Advance Payments Register <span className="muted" style={{ fontWeight: 400 }}>({advances.length})</span>
          </h2>
        </div>

        <div className="toolbar" style={{ padding: "14px 16px 0", marginBottom: 0 }}>
          <input
            placeholder="Search by employee name, code, note, payment method…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            <option value="All">All Deduction Months</option>
            {MONTH_NAMES.map((name, i) => (
              <option key={i + 1} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
            <option value="All">All Years</option>
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="pending">Pending Deduction</option>
            <option value="deducted">Deducted in Payroll</option>
          </select>
        </div>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 110 }}>Advance ID</th>
                <th style={{ minWidth: 200 }}>Employee</th>
                <th style={{ width: 130 }}>Date Given</th>
                <th style={{ width: 140 }}>Deduction Period</th>
                <th style={{ width: 130 }}>Payment Method</th>
                <th style={{ minWidth: 160 }}>Note / Remarks</th>
                <th style={{ width: 130, textAlign: "right" }}>Advance Amount</th>
                <th style={{ width: 150 }}>Status</th>
                <th style={{ width: 95, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {advances.length > 0 ? (
                advances.map((adv, idx) => {
                  const empName = adv.employeeName || `${adv.employee?.firstName || ""} ${adv.employee?.lastName || ""}`.trim() || "Employee";
                  const empCode = adv.employeeId || adv.employee?.employeeId || "EMP";
                  const empDept = adv.employee?.department || "Production / Workshop";

                  return (
                    <tr key={adv._id || adv.id || idx}>
                      <td>
                        <b style={{ color: "#103567", fontSize: 12 }}>
                          {adv.advanceId || `ADV-${String(idx + 1).padStart(4, "0")}`}
                        </b>
                      </td>
                      <td>
                        <div className="customer">
                          <div className="miniavatar">{getInitials(empName)}</div>
                          <div>
                            <b style={{ color: "#0f172a", fontSize: 13 }}>{empName}</b>
                            <small style={{ color: "#64748b" }}>
                              {empCode} · {empDept}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#334155" }}>
                          {adv.paymentDate ? dayjs(adv.paymentDate).format("DD MMM YYYY") : "—"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: "#103567", fontWeight: 600 }}>
                          {adv.month ? `${MONTH_NAMES[adv.month - 1]} ${adv.year || currentYear}` : "—"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: "#475569" }}>
                          {adv.paymentMethod || "Cash"}
                        </span>
                      </td>
                      <td>
                        {adv.notes ? (
                          <span style={{ fontSize: 12, color: "#334155" }}>
                            {adv.notes}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: 11 }}>
                            No note added
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <b style={{ color: "#dc2626", fontSize: 14 }}>
                          ₹{Number(adv.amount || 0).toLocaleString("en-IN")}
                        </b>
                      </td>
                      <td>{statusPill(adv.status)}</td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            className="btn"
                            style={{ padding: "4px 8px", fontSize: 12 }}
                            onClick={() => handleOpenEditModal(adv)}
                            title="Edit Advance Payment"
                          >
                            ✏ Edit
                          </button>
                          <button
                            className="btn"
                            style={{
                              padding: "4px 8px",
                              fontSize: 12,
                              color: "var(--red)",
                              borderColor: "#fca5a5",
                              background: "#fef2f2",
                            }}
                            onClick={() => handleDeleteAdvance(adv)}
                            title="Delete Record"
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9">
                    <div className="emptyhint">
                      <b>No advance payments found</b>
                      {loading ? "Loading advance records..." : "Click '+ Add Advance Payment' above to disburse advance salary to an employee."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {advances.length > 0 && (
              <tfoot>
                <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "2px solid #cbd5e1" }}>
                  <td colSpan={6} style={{ textAlign: "right", padding: "10px 14px", color: "#334155" }}>
                    TOTAL ADVANCE PAYMENTS:
                  </td>
                  <td style={{ textAlign: "right", padding: "10px 14px", color: "#dc2626", fontSize: 15 }}>
                    ₹{stats.totalAmount.toLocaleString("en-IN")}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div style={{ padding: "12px 16px", color: "#8390a2", fontSize: 11, borderTop: "1px solid var(--line)" }}>
          Showing {advances.length} advance payment records · Subtracted directly from employee payroll calculation
        </div>
      </div>

      {/* Create / Edit Advance Payment Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div
            className="modal"
            style={{ maxWidth: 580 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
              <div>
                <h2 style={{ margin: 0, color: "#103567" }}>
                  {editingAdvance ? "Edit Advance Payment" : "Record Advance Salary Payment"}
                </h2>
                <small className="muted">
                  The advance amount will be automatically subtracted from the employee's payroll estimated salary.
                </small>
              </div>
              <button
                className="btn"
                style={{ padding: "4px 8px" }}
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <div className="cardbody" style={{ padding: "18px 20px" }}>
              <div className="formgrid" style={{ gridTemplateColumns: "1fr", gap: 14 }}>
                {/* 1. Employee Selection */}
                <div className="field">
                  <label style={{ fontWeight: 600, color: "#0f172a" }}>Select Employee *</label>
                  <select
                    value={form.employee}
                    onChange={(e) => setForm({ ...form, employee: e.target.value })}
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map((emp) => {
                      const empSal = Number(emp.salary?.basic || emp.salary?.grossSalary || emp.baseSalary || 0);
                      return (
                        <option key={emp._id || emp.id} value={emp._id || emp.id}>
                          {emp.firstName} {emp.lastName} ({emp.employeeId || "EMP"}) — Base Salary: ₹{empSal.toLocaleString("en-IN")}
                        </option>
                      );
                    })}
                  </select>
                  {selectedEmpSalary > 0 && (
                    <small style={{ color: "#103567", fontWeight: 600, marginTop: 4, display: "block" }}>
                      Employee Monthly Salary: ₹{selectedEmpSalary.toLocaleString("en-IN")}
                    </small>
                  )}
                </div>

                {/* 2. Advance Amount & Date Given */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="field">
                    <label style={{ fontWeight: 600, color: "#0f172a" }}>Advance Amount (₹) *</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="e.g. 5000"
                    />
                  </div>

                  <div className="field">
                    <label style={{ fontWeight: 600, color: "#0f172a" }}>Date Given *</label>
                    <input
                      type="date"
                      value={form.paymentDate}
                      onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                    />
                  </div>
                </div>

                {/* 3. Deduction Period (Month & Year) & Payment Method */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="field">
                    <label style={{ fontWeight: 600, color: "#0f172a" }}>Deduct From Payroll Month *</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <select
                        style={{ flex: 2 }}
                        value={form.month}
                        onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}
                      >
                        {MONTH_NAMES.map((name, i) => (
                          <option key={i + 1} value={i + 1}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <select
                        style={{ flex: 1.2 }}
                        value={form.year}
                        onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                      >
                        {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="field">
                    <label style={{ fontWeight: 600, color: "#0f172a" }}>Payment Method</label>
                    <select
                      value={form.paymentMethod}
                      onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4. Notes / Reason (Optional) */}
                <div className="field">
                  <label>Note / Purpose (Optional)</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="e.g. Personal emergency, Medical expense, Festival advance, etc."
                  />
                </div>

                {/* 5. Status (if editing) */}
                {editingAdvance && (
                  <div className="field">
                    <label style={{ fontWeight: 600, color: "#0f172a" }}>Deduction Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                    >
                      <option value="pending">Pending Deduction (To subtract from salary)</option>
                      <option value="deducted">Deducted in Payroll (Already recovered)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Deduction Preview Notice */}
              {Number(form.amount) > 0 && selectedEmpSalary > 0 && (
                <div style={{ marginTop: 14, background: "#fef2f2", border: "1px solid #fecaca", padding: "10px 14px", borderRadius: 6, fontSize: 12 }}>
                  <span style={{ color: "#991b1b", fontWeight: 700 }}>Payroll Impact Preview:</span>
                  <div style={{ marginTop: 4, color: "#7f1d1d" }}>
                    Employee's base salary ₹{selectedEmpSalary.toLocaleString("en-IN")} will have <b>−₹{Number(form.amount).toLocaleString("en-IN")}</b> subtracted in the {MONTH_NAMES[form.month - 1]} {form.year} payroll calculation.
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 20,
                  paddingTop: 14,
                  borderTop: "1px solid var(--line)",
                }}
              >
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={handleSaveAdvance}
                  disabled={saving}
                  style={{ background: "#103567", borderColor: "#103567", fontWeight: 700 }}
                >
                  {saving ? "Saving..." : editingAdvance ? "💾 Update Advance" : "＋ Record Advance Payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

