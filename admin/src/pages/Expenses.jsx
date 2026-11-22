import React, { useState, useEffect, useCallback } from "react";
import { App } from "antd";
import dayjs from "dayjs";
import { expenseAPI } from "../services/api";

const EXPENSE_CATEGORIES = [
  "Raw Materials & Hardware",
  "Factory & Machinery",
  "Logistics & Transport",
  "Electricity & Utilities",
  "Office & Admin",
  "Salaries & Labour",
  "Marketing & Sales",
  "General",
];

const PAYMENT_METHODS = [
  "Cash",
  "UPI / GPay / PhonePe",
  "Bank Transfer / NEFT",
  "Cheque",
  "Credit / Debit Card",
];

function categoryPill(category) {
  const cat = (category || "").toLowerCase();
  let c = "blue";
  if (/raw|hardware/.test(cat)) c = "amber";
  else if (/factory|machinery/.test(cat)) c = "blue";
  else if (/transport|logistics/.test(cat)) c = "green";
  else if (/electric|utilit/.test(cat)) c = "red";
  else if (/office|admin/.test(cat)) c = "purple";

  return <span className={`pill ${c}`}>{category || "General"}</span>;
}

export default function Expenses() {
  const { message, modal } = App.useApp();
  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState({
    totalAmount: 0,
    thisMonthAmount: 0,
    todayAmount: 0,
    count: 0,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  const [form, setForm] = useState({
    title: "",
    amount: "",
    expenseDate: dayjs().format("YYYY-MM-DD"),
    category: "General",
    paymentMethod: "Cash",
    paidTo: "",
    notes: "",
  });

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await expenseAPI.list({
        search: search.trim() || undefined,
        category: categoryFilter !== "All" ? categoryFilter : undefined,
      });

      setExpenses(res.data?.expenses || []);
      if (res.data?.stats) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
      message.error("Failed to load expenses list.");
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleOpenCreateModal = () => {
    setEditingExpense(null);
    setForm({
      title: "",
      amount: "",
      expenseDate: dayjs().format("YYYY-MM-DD"),
      category: "General",
      paymentMethod: "Cash",
      paidTo: "",
      notes: "",
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (exp) => {
    setEditingExpense(exp);
    setForm({
      title: exp.title || "",
      amount: exp.amount !== undefined ? exp.amount : "",
      expenseDate: exp.expenseDate ? dayjs(exp.expenseDate).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
      category: exp.category || "General",
      paymentMethod: exp.paymentMethod || "Cash",
      paidTo: exp.paidTo || "",
      notes: exp.notes || "",
    });
    setShowModal(true);
  };

  const handleSaveExpense = async () => {
    if (!form.title.trim()) {
      message.error("Please enter the expense name.");
      return;
    }

    if (form.amount === "" || isNaN(Number(form.amount)) || Number(form.amount) < 0) {
      message.error("Please enter a valid expense price/amount.");
      return;
    }

    if (!form.expenseDate) {
      message.error("Please select the date of expense created.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        category: form.category,
        paymentMethod: form.paymentMethod,
        paidTo: form.paidTo.trim(),
        notes: form.notes.trim(),
      };

      if (editingExpense) {
        await expenseAPI.update(editingExpense._id || editingExpense.id, payload);
        message.success("Expense updated successfully!");
      } else {
        await expenseAPI.create(payload);
        message.success("Expense recorded successfully!");
      }

      setShowModal(false);
      fetchExpenses();
    } catch (err) {
      console.error("Error saving expense:", err);
      message.error(err.response?.data?.message || "Failed to save expense.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = (exp) => {
    modal.confirm({
      title: "Delete Expense Record?",
      content: `Are you sure you want to delete "${exp.title}" (₹${Number(exp.amount || 0).toLocaleString("en-IN")})? This action cannot be undone.`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await expenseAPI.delete(exp._id || exp.id);
          message.success("Expense deleted successfully.");
          fetchExpenses();
        } catch (err) {
          message.error(err.response?.data?.message || "Failed to delete expense.");
        }
      },
    });
  };

  return (
    <>
      <div className="crumb">
        DD UPVC <span style={{ margin: "0 6px" }}>/</span> EXPENSES &amp; ACCOUNTS
      </div>

      <div className="pagehead">
        <div>
          <h1>Expenses &amp; Accounts</h1>
          <p>Record, manage and track operational costs, workshop expenses, and payments with live totals.</p>
        </div>
        <div className="actions">
          <button
            className="btn primary"
            onClick={handleOpenCreateModal}
            style={{ background: "#103567", borderColor: "#103567", fontWeight: 600 }}
          >
            ＋ Record Expense
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid stats">
        <div className="card stat">
          <div className="statrow">
            <span>Total Expenses</span>
            <span className="staticon">₹</span>
          </div>
          <strong>₹{stats.totalAmount.toLocaleString("en-IN")}</strong>
          <span className="trend">{stats.count} recorded entries</span>
        </div>

        <div className="card stat">
          <div className="statrow">
            <span>This Month</span>
            <span className="staticon">▧</span>
          </div>
          <strong>₹{stats.thisMonthAmount.toLocaleString("en-IN")}</strong>
          <span className="trend" style={{ color: "var(--amber)" }}>Current monthly billing</span>
        </div>

        <div className="card stat">
          <div className="statrow">
            <span>Today's Outflow</span>
            <span className="staticon">◷</span>
          </div>
          <strong>₹{stats.todayAmount.toLocaleString("en-IN")}</strong>
          <span className="trend" style={{ color: stats.todayAmount > 0 ? "var(--red)" : "var(--muted)" }}>
            Daily expenditure
          </span>
        </div>

        <div className="card stat">
          <div className="statrow">
            <span>Average / Entry</span>
            <span className="staticon">▦</span>
          </div>
          <strong>
            ₹{stats.count > 0 ? Math.round(stats.totalAmount / stats.count).toLocaleString("en-IN") : 0}
          </strong>
          <span className="trend">Average ticket size</span>
        </div>
      </div>

      {/* Expenses Table Card */}
      <div className="card">
        <div className="cardhead">
          <h2>
            Expenses Register <span className="muted" style={{ fontWeight: 400 }}>({expenses.length})</span>
          </h2>
        </div>

        <div className="toolbar" style={{ padding: "14px 16px 0", marginBottom: 0 }}>
          <input
            placeholder="Search by expense name, category, payment mode, paid to…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="All">All Categories</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 110 }}>Expense ID</th>
                <th style={{ minWidth: 200 }}>Expense Name</th>
                <th style={{ width: 160 }}>Category</th>
                <th style={{ width: 130 }}>Date of Expense</th>
                <th style={{ width: 140 }}>Payment Method</th>
                <th style={{ width: 130, textAlign: "right" }}>Price / Amount</th>
                <th style={{ width: 110, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length > 0 ? (
                expenses.map((exp, idx) => {
                  return (
                    <tr key={exp._id || exp.id || idx}>
                      <td>
                        <b style={{ color: "#103567", fontSize: 12 }}>
                          {exp.expenseId || `EXP-${String(idx + 1).padStart(4, "0")}`}
                        </b>
                      </td>
                      <td>
                        <div>
                          <b style={{ color: "#0f172a", fontSize: 13 }}>{exp.title}</b>
                          {exp.paidTo && (
                            <small style={{ display: "block", color: "#64748b", fontSize: 11 }}>
                              Paid to: {exp.paidTo}
                            </small>
                          )}
                          {exp.notes && (
                            <small style={{ display: "block", color: "#8390a2", fontSize: 11, fontStyle: "italic" }}>
                              {exp.notes}
                            </small>
                          )}
                        </div>
                      </td>
                      <td>{categoryPill(exp.category)}</td>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#334155" }}>
                          {exp.expenseDate ? dayjs(exp.expenseDate).format("DD MMM YYYY") : "—"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: "#475569" }}>
                          {exp.paymentMethod || "Cash"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <b style={{ color: "#103567", fontSize: 14 }}>
                          ₹{Number(exp.amount || 0).toLocaleString("en-IN")}
                        </b>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            className="btn"
                            style={{ padding: "4px 8px", fontSize: 12 }}
                            onClick={() => handleOpenEditModal(exp)}
                            title="Edit Expense"
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
                            onClick={() => handleDeleteExpense(exp)}
                            title="Delete Expense"
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
                  <td colSpan="7">
                    <div className="emptyhint">
                      <b>No expenses recorded</b>
                      {loading ? "Loading expenses..." : "Click '+ Record Expense' above to create your first expense entry."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {expenses.length > 0 && (
              <tfoot>
                <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "2px solid #cbd5e1" }}>
                  <td colSpan={5} style={{ textAlign: "right", padding: "10px 14px", color: "#334155" }}>
                    TOTAL RECORDED EXPENSES:
                  </td>
                  <td style={{ textAlign: "right", padding: "10px 14px", color: "#103567", fontSize: 15 }}>
                    ₹{stats.totalAmount.toLocaleString("en-IN")}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div style={{ padding: "12px 16px", color: "#8390a2", fontSize: 11, borderTop: "1px solid var(--line)" }}>
          Showing {expenses.length} entries · DD UPVC Workshop &amp; Accounts Ledger
        </div>
      </div>

      {/* Create / Edit Expense Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div
            className="modal"
            style={{ maxWidth: 560 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
              <div>
                <h2 style={{ margin: 0, color: "#103567" }}>
                  {editingExpense ? "Edit Expense Record" : "Record New Expense"}
                </h2>
                <small className="muted">
                  Enter expense name, price/amount, and date of expense created.
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
                {/* 1. Expense Name */}
                <div className="field">
                  <label style={{ fontWeight: 600, color: "#0f172a" }}>Expense Name / Title *</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Factory Electricity Bill / Diesel for Delivery / Raw Materials"
                    autoFocus
                  />
                </div>

                {/* 2. Price / Amount & Date of Expense */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="field">
                    <label style={{ fontWeight: 600, color: "#0f172a" }}>Price / Amount (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="e.g. 4500"
                    />
                  </div>

                  <div className="field">
                    <label style={{ fontWeight: 600, color: "#0f172a" }}>Date of Expense Created *</label>
                    <input
                      type="date"
                      value={form.expenseDate}
                      onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                    />
                  </div>
                </div>

                {/* 3. Category & Payment Method */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="field">
                    <label style={{ fontWeight: 600, color: "#0f172a" }}>Expense Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
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

                {/* 4. Paid To (Vendor / Person) */}
                <div className="field">
                  <label>Paid To / Vendor Name (Optional)</label>
                  <input
                    value={form.paidTo}
                    onChange={(e) => setForm({ ...form, paidTo: e.target.value })}
                    placeholder="e.g. MP State Electricity Board / Local Hardware Depot"
                  />
                </div>

                {/* 5. Notes */}
                <div className="field">
                  <label>Notes / Bill Reference (Optional)</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Bill number, receipt reference, or extra details..."
                  />
                </div>
              </div>

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
                  onClick={handleSaveExpense}
                  disabled={saving}
                  style={{ background: "#103567", borderColor: "#103567", fontWeight: 700 }}
                >
                  {saving ? "Saving..." : editingExpense ? "💾 Update Expense" : "＋ Create Expense"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

