import React, { useState, useEffect } from "react";
import { App } from "antd";
import dayjs from "dayjs";
import { paymentAPI, customerAPI, supplierAPI } from "../services/api";

function statusPill(s) {
  const x = (s || "").toLowerCase();
  let c = /completed|received|paid/.test(x) ? "green" : /failed|cancelled/.test(x) ? "red" : "amber";
  return <span className={`pill ${c}`}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : "Completed"}</span>;
}

export default function Payments() {
  const { message } = App.useApp();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Record Payment Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({
    type: "customer_payment", // "customer_payment" | "supplier_payment"
    partyId: "",
    amount: "",
    paymentMode: "bank_transfer",
    referenceNumber: "",
    notes: "",
    paymentDate: dayjs().format("YYYY-MM-DD"),
  });

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await paymentAPI.list({ limit: 100 });
      setPayments(res.data?.payments || res.data?.data?.payments || []);
    } catch (err) {
      console.error("Failed to load payments:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadParties = async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        customerAPI.list({ limit: 100 }),
        supplierAPI.list({ limit: 100 }),
      ]);
      setCustomers(cRes.data?.customers || cRes.data?.data?.customers || []);
      setSuppliers(sRes.data?.suppliers || sRes.data?.data?.suppliers || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPayments();
    loadParties();
  }, []);

  const handleOpenModal = () => {
    setForm({
      type: "customer_payment",
      partyId: customers[0]?._id || "",
      amount: "",
      paymentMode: "bank_transfer",
      referenceNumber: `TXN-${Date.now().toString().slice(-6)}`,
      notes: "",
      paymentDate: dayjs().format("YYYY-MM-DD"),
    });
    setIsModalOpen(true);
  };

  const handleSavePayment = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      message.error("Valid payment amount is required.");
      return;
    }
    try {
      const payload = {
        paymentType: form.type === "customer_payment" ? "inward" : "outward",
        category: form.type === "customer_payment" ? "customer_collection" : "supplier_payment",
        amount: Number(form.amount),
        paymentMode: form.paymentMode,
        referenceNumber: form.referenceNumber,
        notes: form.notes,
        paymentDate: form.paymentDate,
        customer: form.type === "customer_payment" ? form.partyId : undefined,
        supplier: form.type === "supplier_payment" ? form.partyId : undefined,
      };

      await paymentAPI.create(payload);
      message.success("Payment recorded successfully.");
      setIsModalOpen(false);
      fetchPayments();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to record payment.");
    }
  };

  const filteredPayments = payments.filter((p) => {
    const partyName = p.customer?.companyName || p.supplier?.companyName || p.partyName || "";
    const matches =
      partyName.toLowerCase().includes(search.toLowerCase()) ||
      (p.referenceNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.paymentNumber || "").toLowerCase().includes(search.toLowerCase());
    if (!matches) return false;
    if (typeFilter === "all") return true;
    if (typeFilter === "inward") return p.paymentType === "inward" || p.category === "customer_collection";
    if (typeFilter === "outward") return p.paymentType === "outward" || p.category === "supplier_payment";
    return true;
  });

  const totalCollected = payments
    .filter((p) => p.paymentType === "inward" || p.category === "customer_collection")
    .reduce((acc, p) => acc + (p.amount || 0), 0);

  const totalPaidOut = payments
    .filter((p) => p.paymentType === "outward" || p.category === "supplier_payment")
    .reduce((acc, p) => acc + (p.amount || 0), 0);

  return (
    <>
      <div className="crumb">
        DD UPVC <span style={{ margin: "0 6px" }}>/</span> EXPENSES &amp; ACCOUNTS
      </div>
      <div className="pagehead">
        <div>
          <h1>Expenses &amp; Accounts</h1>
          <p>Track business receipts, customer collections, vendor disbursements and account balances.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => message.info("Export prepared in connected application.")}>
            ⇩ Export
          </button>
          <button className="btn primary" onClick={handleOpenModal}>
            ＋ Record payment
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid stats">
        <div className="card stat">
          <div className="statrow">
            <span>Customer collections</span>
            <span className="staticon">↗</span>
          </div>
          <strong>₹{totalCollected.toLocaleString("en-IN")}</strong>
          <span className="trend" style={{ color: "var(--green)" }}>Inward receipts</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Vendor payouts</span>
            <span className="staticon">⇄</span>
          </div>
          <strong>₹{totalPaidOut.toLocaleString("en-IN")}</strong>
          <span className="trend">Material disbursements</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Net cash balance</span>
            <span className="staticon">₹</span>
          </div>
          <strong>₹{(totalCollected - totalPaidOut).toLocaleString("en-IN")}</strong>
          <span className="trend">Current liquidity</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Total transactions</span>
            <span className="staticon">▧</span>
          </div>
          <strong>{payments.length}</strong>
          <span className="trend">Settled entries</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card">
        <div className="cardhead">
          <h2>
            Transaction Register <span className="muted" style={{ fontWeight: 400 }}>({filteredPayments.length})</span>
          </h2>
          <button className="btn" onClick={() => message.info("Filter panel ready.")}>
            ☷ Filters
          </button>
        </div>

        <div className="toolbar" style={{ padding: "14px 16px 0", marginBottom: 0 }}>
          <input
            placeholder="Search by transaction reference, party, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All transactions</option>
            <option value="inward">Inward (Collections)</option>
            <option value="outward">Outward (Disbursements)</option>
          </select>
        </div>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Txn Ref</th>
                <th>Party / Description</th>
                <th>Date</th>
                <th>Payment Mode</th>
                <th>Direction</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length > 0 ? (
                filteredPayments.map((r, i) => {
                  const isInward = r.paymentType === "inward" || r.category === "customer_collection";
                  const partyName = r.customer?.companyName || r.supplier?.companyName || r.partyName || "Direct Transaction";
                  return (
                    <tr key={r._id || i}>
                      <td>
                        <b>{r.referenceNumber || r.paymentNumber || `TXN-${1000 + i}`}</b>
                      </td>
                      <td>
                        <div className="customer">
                          <div className="miniavatar" style={{ background: isInward ? "#e5f7ef" : "#edf2fa", color: isInward ? "#16845b" : "#45617f" }}>
                            {isInward ? "↓" : "↑"}
                          </div>
                          <div>
                            <b>{partyName}</b>
                            <small>{r.notes || (isInward ? "Customer payment" : "Supplier bill clearance")}</small>
                          </div>
                        </div>
                      </td>
                      <td>{dayjs(r.paymentDate || r.createdAt).format("DD MMM YYYY")}</td>
                      <td>{(r.paymentMode || "Bank Transfer").replace("_", " ").toUpperCase()}</td>
                      <td>
                        <span className={`pill ${isInward ? "green" : "blue"}`}>
                          {isInward ? "INWARD" : "OUTWARD"}
                        </span>
                      </td>
                      <td>
                        <b style={{ color: isInward ? "var(--green)" : "var(--navy)", fontSize: 13 }}>
                          {isInward ? "+" : "-"} ₹{Number(r.amount || 0).toLocaleString("en-IN")}
                        </b>
                      </td>
                      <td>{statusPill(r.status || "completed")}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7">
                    <div className="emptyhint">
                      <b>No transaction records found</b>
                      {loading ? "Loading payments..." : "Click '+ Record payment' to log an entry."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 16px", color: "#8390a2", fontSize: 11, borderTop: "1px solid var(--line)" }}>
          Showing {filteredPayments.length} entries · DD UPVC Financial Ledger
        </div>
      </div>

      {/* Feature section grid */}
      <div className="grid sectiongrid" style={{ marginTop: 16 }}>
        {[
          ["Expense Register", "Record operating factory expenses, freight, electricity and consumables.", "₹"],
          ["Cash & Bank Accounts", "Reconcile bank accounts, UPI collections and cash payments.", "▣"],
          ["Receivables & Payables", "Real-time ageing of pending invoices and vendor bills.", "↗"],
        ].map((a, i) => (
          <div className="card feature" key={i}>
            <div className="featureicon">{a[2]}</div>
            <h3>{a[0]}</h3>
            <p>{a[1]}</p>
          </div>
        ))}
      </div>

      {/* Record Payment Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="cardhead">
              <h2>Record Payment / Expense</h2>
              <button className="btn" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="cardbody">
              <div className="formgrid">
                <div className="field">
                  <label>Transaction Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    <option value="customer_payment">Customer Collection (Inward +)</option>
                    <option value="supplier_payment">Supplier / Expense Payout (Outward -)</option>
                  </select>
                </div>

                <div className="field">
                  <label>Select Party</label>
                  {form.type === "customer_payment" ? (
                    <select
                      value={form.partyId}
                      onChange={(e) => setForm({ ...form, partyId: e.target.value })}
                    >
                      {customers.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.companyName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={form.partyId}
                      onChange={(e) => setForm({ ...form, partyId: e.target.value })}
                    >
                      {suppliers.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.companyName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="field">
                  <label>Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="Enter amount"
                  />
                </div>

                <div className="field">
                  <label>Payment Mode</label>
                  <select
                    value={form.paymentMode}
                    onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}
                  >
                    <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="upi">UPI / QR Code</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>

                <div className="field">
                  <label>Reference / UTR Number</label>
                  <input
                    value={form.referenceNumber}
                    onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                    placeholder="e.g. UTR / Cheque No"
                  />
                </div>

                <div className="field">
                  <label>Payment Date</label>
                  <input
                    type="date"
                    value={form.paymentDate}
                    onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                  />
                </div>

                <div className="field full">
                  <label>Notes / Narration</label>
                  <textarea
                    rows="2"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Description / invoice reference"
                  />
                </div>
              </div>
            </div>
            <div className="modalfoot">
              <button className="btn" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={handleSavePayment}>
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
