import React, { useState, useEffect, useCallback, useRef } from "react";
import { App } from "antd";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { salesOrderAPI, settingsAPI } from "../services/api";

// Helper to check if order is in production
export function isInProduction(status) {
  if (!status) return false;
  const s = String(status).trim().toLowerCase().replace(/[-_]/g, " ");
  return s === "in production" || s === "production";
}

// Order status pill matching SalesOrders.jsx
function orderStatusPill(s) {
  const x = (s || "").toLowerCase();
  let c = /delivered|completed/.test(x)
    ? "green"
    : /ready|dispatched/.test(x)
    ? "blue"
    : /in-production|production/.test(x)
    ? "purple"
    : /cancelled/.test(x)
    ? "red"
    : "amber";
  return <span className={`pill ${c}`}>{s ? s.replace(/[-_]/g, " ").toUpperCase() : "CONFIRMED"}</span>;
}

// Production stages
const PRODUCTION_STAGES = [
  "1. Material Sizing & Cutting",
  "2. Steel Reinforcement & Milling",
  "3. Corner Welding & Cleaning",
  "4. Hardware & Multipoint Locking",
  "5. Glazing & Rubber Gaskets",
  "6. Final QC & Packaging",
];

// Helper to format address
function extractAddressString(addr) {
  if (!addr) return "";
  if (typeof addr === "string") {
    try {
      const p = JSON.parse(addr);
      if (typeof p === "object" && p) {
        return [p.street || p.address || p.line1, p.city, p.state].filter(Boolean).join(", ");
      }
    } catch {}
    return addr;
  }
  if (typeof addr === "object") {
    return [addr.street || addr.address || addr.line1, addr.city, addr.state].filter(Boolean).join(", ");
  }
  return String(addr);
}

export default function Production() {
  const { message } = App.useApp();
  const { admin } = useAuth();
  const navigate = useNavigate();
  const printRef = useRef(null);

  const [orders, setOrders] = useState([]);
  const [companySettings, setCompanySettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("in-production"); // Default: in-production
  const [stageFilter, setStageFilter] = useState("All");

  // Status & Stage update modal
  const [statusModalOrder, setStatusModalOrder] = useState(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusForm, setStatusForm] = useState({
    status: "in-production",
    productionStage: PRODUCTION_STAGES[0],
    productionNotes: "",
  });

  // Dynamic Job Card State
  const [jobCardOrder, setJobCardOrder] = useState(null);
  const [jobCardNotes, setJobCardNotes] = useState("");
  const [jobCardSupervisor, setJobCardSupervisor] = useState("");
  const [jobCardDate, setJobCardDate] = useState("");
  const [jobCardStatus, setJobCardStatus] = useState("Passed & Approved");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isEditingSignOff, setIsEditingSignOff] = useState(false);
  const [savingJobCard, setSavingJobCard] = useState(false);

  // Fetch company settings for dynamic Job Card header
  useEffect(() => {
    let isMounted = true;
    settingsAPI
      .get()
      .then((res) => {
        if (isMounted && res.data?.settings) {
          setCompanySettings(res.data.settings);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesOrderAPI.list({ limit: 500 });
      setOrders(res.data?.orders || []);
    } catch (err) {
      console.error(err);
      message.error("Failed to load production orders.");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Orders in production
  const inProductionOrders = orders.filter((o) => isInProduction(o.status));
  const activeProductionCount = inProductionOrders.length;

  const totalInProductionUnits = inProductionOrders.reduce((sum, o) => {
    const items = Array.isArray(o.items) ? o.items : [];
    return sum + items.reduce((iSum, it) => iSum + (Number(it.quantity) || 1), 0);
  }, 0);

  const totalInProductionSqFt = inProductionOrders.reduce((sum, o) => {
    const items = Array.isArray(o.items) ? o.items : [];
    return (
      sum +
      items.reduce((iSum, it) => {
        const qty = Number(it.quantity) || 1;
        const sqFt = Number(it.sqFt) || 0;
        return iSum + sqFt * qty;
      }, 0)
    );
  }, 0);

  const totalInProductionValue = inProductionOrders.reduce(
    (sum, o) => sum + (Number(o.totalAmount) || 0),
    0
  );

  // Filter orders based on status, stage, and search
  const filteredOrders = orders.filter((o) => {
    // 1. Status Filter (defaults to in-production)
    if (statusFilter === "in-production") {
      if (!isInProduction(o.status)) return false;
    } else if (statusFilter !== "All") {
      if ((o.status || "").toLowerCase() !== statusFilter.toLowerCase()) return false;
    }

    // 2. Stage Filter
    if (stageFilter !== "All") {
      const currentStage = o.productionStage || PRODUCTION_STAGES[0];
      if (currentStage !== stageFilter) return false;
    }

    // 3. Search Filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const orderNo = (o.orderNumber || "").toLowerCase();
      const client = (
        o.customerSnapshot?.companyName ||
        o.customer?.companyName ||
        o.customerSnapshot?.name ||
        o.customer?.name ||
        ""
      ).toLowerCase();
      const proj = (o.projectName || "").toLowerCase();
      if (!orderNo.includes(q) && !client.includes(q) && !proj.includes(q)) {
        return false;
      }
    }

    return true;
  });

  const handleOpenStatusModal = (order) => {
    setStatusModalOrder(order);
    setStatusForm({
      status: order.status || "in-production",
      productionStage: order.productionStage || PRODUCTION_STAGES[0],
      productionNotes: order.productionNotes || order.notes || "",
    });
  };

  const handleSaveStatus = async () => {
    if (!statusModalOrder) return;
    setSavingStatus(true);
    try {
      const payload = {
        status: statusForm.status,
        productionStage: statusForm.productionStage,
        productionNotes: statusForm.productionNotes,
      };
      await salesOrderAPI.update(statusModalOrder._id || statusModalOrder.id, payload);
      message.success(`Order ${statusModalOrder.orderNumber} updated successfully.`);
      setOrders((prev) =>
        prev.map((o) =>
          (o._id || o.id) === (statusModalOrder._id || statusModalOrder.id) ? { ...o, ...payload } : o
        )
      );
      setStatusModalOrder(null);
    } catch (err) {
      console.error(err);
      message.error("Failed to update status.");
    } finally {
      setSavingStatus(false);
    }
  };

  // Open Dynamic Job Card
  const handleOpenJobCard = (order) => {
    setJobCardOrder(order);
    setJobCardNotes(
      order.productionNotes ||
        order.notes ||
        "Fabricate using Prominance lead-free uPVC profiles. Ensure drainage slots are punched and steel reinforcement is screwed every 300mm."
    );
    setJobCardSupervisor(order.supervisorName || admin?.name || "Abhishek Jain");
    setJobCardDate(
      order.inspectionDate
        ? dayjs(order.inspectionDate).format("YYYY-MM-DD")
        : dayjs().format("YYYY-MM-DD")
    );
    setJobCardStatus(order.inspectionStatus || "Passed & Approved");
    setIsEditingNotes(false);
    setIsEditingSignOff(false);
  };

  // Save Dynamic Job Card (Notes & Quality Inspection Sign-off)
  const handleSaveJobCardDetails = async () => {
    if (!jobCardOrder) return;
    setSavingJobCard(true);
    try {
      const payload = {
        productionNotes: jobCardNotes,
        supervisorName: jobCardSupervisor,
        inspectionDate: jobCardDate ? dayjs(jobCardDate).toDate() : new Date(),
        inspectionStatus: jobCardStatus,
        supervisorSign: jobCardSupervisor,
      };

      await salesOrderAPI.update(jobCardOrder._id || jobCardOrder.id, payload);
      message.success("Job card notes & quality inspection sign-off saved successfully!");

      // Update local states
      setJobCardOrder((prev) => ({ ...prev, ...payload }));
      setOrders((prev) =>
        prev.map((o) =>
          (o._id || o.id) === (jobCardOrder._id || jobCardOrder.id) ? { ...o, ...payload } : o
        )
      );
      setIsEditingNotes(false);
      setIsEditingSignOff(false);
    } catch (err) {
      console.error(err);
      message.error("Failed to save job card updates.");
    } finally {
      setSavingJobCard(false);
    }
  };

  return (
    <>
      <style>{`
        .pill.purple {
          background: #f3e8ff;
          color: #7e22ce;
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-job-card, #printable-job-card * {
            visibility: visible !important;
          }
          #printable-job-card {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            background: #ffffff !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
        }
        @media screen {
          .print-only {
            display: none;
          }
        }
      `}</style>

      {/* ── Breadcrumb & Page Head matching exact UI of SalesOrders & Customers ── */}
      <div className="crumb">
        DD UPVC <span style={{ margin: "0 6px" }}>/</span> PRODUCTION &amp; FABRICATION
      </div>
      <div className="pagehead">
        <div>
          <h1>Production</h1>
          <p>Fabrication work orders, glass specifications, cutting lists and shop floor fulfillment.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={fetchOrders} disabled={loading}>
            ↻ {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button className="btn primary" onClick={() => navigate("/sales")}>
            ＋ View sales orders
          </button>
        </div>
      </div>

      {/* ── KPI Stats Cards matching exact app theme ── */}
      <div className="grid stats">
        <div className="card stat">
          <div className="statrow">
            <span>Active in Production</span>
            <span className="staticon">⚙</span>
          </div>
          <strong style={{ color: "var(--purple)" }}>{activeProductionCount}</strong>
          <span className="trend">Fabrication in shop floor</span>
        </div>

        <div className="card stat">
          <div className="statrow">
            <span>Window Units</span>
            <span className="staticon">🪟</span>
          </div>
          <strong style={{ color: "var(--blue)" }}>{totalInProductionUnits}</strong>
          <span className="trend">Frames &amp; sashes</span>
        </div>

        <div className="card stat">
          <div className="statrow">
            <span>Total Fabrication Area</span>
            <span className="staticon">📐</span>
          </div>
          <strong style={{ color: "var(--green)" }}>{totalInProductionSqFt.toFixed(1)} Sq.Ft</strong>
          <span className="trend">Cumulative profile area</span>
        </div>

        <div className="card stat">
          <div className="statrow">
            <span>Production Queue Value</span>
            <span className="staticon">₹</span>
          </div>
          <strong>₹{totalInProductionValue.toLocaleString("en-IN")}</strong>
          <span className="trend">Order pipeline value</span>
        </div>
      </div>

      {/* ── Main Production Register Card ── */}
      <div className="card">
        <div className="cardhead">
          <div>
            <h2>Production Orders Register</h2>
            <small className="muted">Showing sales orders currently in production queue</small>
          </div>
          <div className="actions">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="btn"
              style={{ padding: "6px 10px" }}
            >
              <option value="in-production">In Production</option>
              <option value="All">All statuses</option>
              <option value="ready">Ready for dispatch</option>
              <option value="delivered">Delivered</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </div>
        </div>

        {/* Toolbar with Search and Stage Filters */}
        <div className="toolbar" style={{ padding: "14px 16px 0", marginBottom: 0 }}>
          <input
            type="text"
            placeholder="Search order #, client, project site…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
            <option value="All">All production stages</option>
            {PRODUCTION_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Table Wrap */}
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Client</th>
                <th>Project / Site</th>
                <th>Order Date</th>
                <th>Target Delivery</th>
                <th>Units &amp; Area</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((r, i) => {
                  const items = Array.isArray(r.items) ? r.items : [];
                  const unitsCount = items.reduce((s, it) => s + (Number(it.quantity) || 1), 0);
                  const sqFtTotal = items.reduce(
                    (s, it) => s + (Number(it.sqFt) || 0) * (Number(it.quantity) || 1),
                    0
                  );
                  const clientName =
                    r.customerSnapshot?.companyName ||
                    r.customer?.companyName ||
                    r.customerSnapshot?.name ||
                    r.customer?.name ||
                    "Client";
                  const clientContact =
                    r.customerSnapshot?.phone ||
                    r.customer?.phone ||
                    r.customerSnapshot?.email ||
                    "";
                  const siteAddr =
                    extractAddressString(r.customerSnapshot?.billingAddress) ||
                    extractAddressString(r.customer?.billingAddress) ||
                    r.projectName ||
                    "Site Address";

                  return (
                    <tr key={r._id || r.id || i}>
                      {/* Order # */}
                      <td>
                        <b>{r.orderNumber || `SO-2026-${String(i + 1).padStart(4, "0")}`}</b>
                      </td>

                      {/* Client with Avatar */}
                      <td>
                        <div className="customer">
                          <div className="miniavatar">
                            {(clientName || "C").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <b>{clientName}</b>
                            <small>{clientContact}</small>
                          </div>
                        </div>
                      </td>

                      {/* Project / Site */}
                      <td>
                        <div><b>{r.projectName || "General Installation"}</b></div>
                        <small className="muted">{siteAddr}</small>
                      </td>

                      {/* Order Date */}
                      <td>{r.orderDate ? dayjs(r.orderDate).format("DD MMM YYYY") : "Today"}</td>

                      {/* Target Delivery */}
                      <td>{r.deliveryDate ? dayjs(r.deliveryDate).format("DD MMM YYYY") : "30 Days"}</td>

                      {/* Units & Area */}
                      <td>
                        <b>{unitsCount} {unitsCount === 1 ? "Unit" : "Units"}</b>
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                          {sqFtTotal.toFixed(1)} Sq.Ft
                        </div>
                      </td>

                      {/* Workshop Stage */}
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            background: "#edf2fa",
                            color: "#334155",
                            padding: "3px 8px",
                            borderRadius: "10px",
                            fontSize: "11px",
                            fontWeight: 600,
                          }}
                        >
                          ⚙ {r.productionStage ? r.productionStage.replace(/^\d+\.\s*/, "") : "Cutting & Sizing"}
                        </span>
                      </td>

                      {/* Status */}
                      <td>{orderStatusPill(r.status)}</td>

                      {/* Action */}
                      <td>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            className="btn"
                            style={{ padding: "6px 12px", fontWeight: 600, color: "var(--navy)" }}
                            onClick={() => handleOpenJobCard(r)}
                          >
                            📋 Job Card
                          </button>
                          <button
                            className="btn"
                            style={{ padding: "6px 12px", fontWeight: 600 }}
                            onClick={() => handleOpenStatusModal(r)}
                          >
                            ⚙ Stage
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
                      <b>No production orders found</b>
                      {statusFilter === "in-production"
                        ? "Currently no sales orders have status 'In Production'."
                        : "Try adjusting your search or status filter."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "12px 16px", color: "#8390a2", fontSize: 11, borderTop: "1px solid var(--line)" }}>
          Showing {filteredOrders.length} production orders · DD UPVC Workshop Pipeline
        </div>
      </div>

      {/* ── Modal: Update Status & Stage ── */}
      {statusModalOrder && (
        <div
          className="no-print"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1050,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setStatusModalOrder(null)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: "520px", overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cardhead">
              <div>
                <h2>Update Production Status</h2>
                <small className="muted">
                  Order <b>{statusModalOrder.orderNumber}</b>
                </small>
              </div>
              <button className="iconbtn" onClick={() => setStatusModalOrder(null)}>
                ✕
              </button>
            </div>

            <div className="cardbody">
              <div className="field" style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, fontSize: "12px" }}>
                  Fulfillment Status
                </label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                  style={{ width: "100%", padding: "10px", borderRadius: "9px", border: "1px solid var(--line)" }}
                >
                  <option value="in-production">In Production</option>
                  <option value="ready">Ready for dispatch</option>
                  <option value="dispatched">Dispatched</option>
                  <option value="delivered">Delivered</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="field" style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, fontSize: "12px" }}>
                  Fabrication Stage
                </label>
                <select
                  value={statusForm.productionStage}
                  onChange={(e) => setStatusForm({ ...statusForm, productionStage: e.target.value })}
                  style={{ width: "100%", padding: "10px", borderRadius: "9px", border: "1px solid var(--line)" }}
                >
                  {PRODUCTION_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 600, fontSize: "12px" }}>
                  Workshop Remarks / Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={statusForm.productionNotes}
                  onChange={(e) => setStatusForm({ ...statusForm, productionNotes: e.target.value })}
                  placeholder="e.g. Profiles cut to size, waiting for glass delivery..."
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "9px",
                    border: "1px solid var(--line)",
                    fontFamily: "inherit",
                    fontSize: "12px",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button type="button" className="btn" onClick={() => setStatusModalOrder(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={handleSaveStatus}
                  disabled={savingStatus}
                >
                  {savingStatus ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Dynamic Job Card / Fabrication Work Order ── */}
      {jobCardOrder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            overflowY: "auto",
          }}
          onClick={() => setJobCardOrder(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "880px",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cardhead no-print">
              <div>
                <h2>Job Card: {jobCardOrder.orderNumber}</h2>
                <small className="muted">
                  {jobCardOrder.customerSnapshot?.companyName || jobCardOrder.customer?.companyName || "Client"} · {jobCardOrder.projectName || "Installation"}
                </small>
              </div>
              <div className="actions">
                <button
                  className="btn"
                  style={{ color: "#103567", borderColor: "#bfdbfe", background: "#eff6ff", fontWeight: 700 }}
                  onClick={handleSaveJobCardDetails}
                  disabled={savingJobCard}
                >
                  {savingJobCard ? "Saving..." : "💾 Save Changes"}
                </button>
                <button className="btn primary" onClick={() => window.print()}>
                  🖨 Print Job Card
                </button>
                <button className="iconbtn" onClick={() => setJobCardOrder(null)}>
                  ✕
                </button>
              </div>
            </div>

            <div
              id="printable-job-card"
              ref={printRef}
              style={{ padding: "24px 28px", overflowY: "auto", flex: 1, background: "#ffffff" }}
            >
              {/* Dynamic Company Header (From Settings) */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  borderBottom: "2px solid #103567",
                  paddingBottom: "14px",
                  marginBottom: "18px",
                }}
              >
                <div>
                  <h1 style={{ margin: "0 0 4px 0", fontSize: "20px", color: "#103567", fontWeight: 800 }}>
                    {companySettings?.companyName || "DD UPVC WINDOW SYSTEMS"}
                  </h1>
                  <p style={{ margin: "0 0 2px 0", fontSize: "11px", color: "#475569" }}>
                    {companySettings?.address || "Kudri (Medical College Road), Shahdol, M.P."} · Phone: {companySettings?.phone || companySettings?.whatsappSender || "+91 9826414729"}
                  </p>
                  <p style={{ margin: 0, fontSize: "11px", color: "#475569" }}>
                    {companySettings?.email || companySettings?.businessEmail || "ddupvcwindowsystem@gmail.com"} · GSTIN: {companySettings?.gstin || "23EVFPG6600A1ZB"}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      background: "#103567",
                      color: "#ffffff",
                      padding: "4px 10px",
                      borderRadius: "4px",
                      fontWeight: 800,
                      fontSize: "12px",
                      letterSpacing: "1px",
                      display: "inline-block",
                      marginBottom: "4px",
                    }}
                  >
                    WORKSHOP JOB CARD
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                    Order: {jobCardOrder.orderNumber}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                    Date: {jobCardOrder.orderDate ? dayjs(jobCardOrder.orderDate).format("DD/MM/YYYY") : "Recent"}
                  </div>
                </div>
              </div>

              {/* Order & Client Meta Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "14px",
                  background: "#f8fafc",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  marginBottom: "18px",
                  fontSize: "12px",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: "#103567", marginBottom: "4px" }}>
                    CLIENT &amp; SITE DETAILS
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "13px" }}>
                    {jobCardOrder.customerSnapshot?.companyName ||
                      jobCardOrder.customer?.companyName ||
                      jobCardOrder.customerSnapshot?.name ||
                      jobCardOrder.customer?.name ||
                      "Client"}
                  </div>
                  <div style={{ color: "#475569", marginTop: "2px" }}>
                    Site:{" "}
                    {extractAddressString(jobCardOrder.customerSnapshot?.billingAddress) ||
                      extractAddressString(jobCardOrder.customer?.billingAddress) ||
                      jobCardOrder.projectName ||
                      "-"}
                  </div>
                  <div style={{ color: "#475569", marginTop: "2px" }}>
                    Phone: {jobCardOrder.customerSnapshot?.phone || jobCardOrder.customer?.phone || "-"}
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 700, color: "#103567", marginBottom: "4px" }}>
                    SCHEDULE &amp; TARGETS
                  </div>
                  <div>
                    <b>Project:</b> {jobCardOrder.projectName || "General Installation"}
                  </div>
                  <div>
                    <b>Target Delivery:</b>{" "}
                    {jobCardOrder.deliveryDate ? dayjs(jobCardOrder.deliveryDate).format("DD/MM/YYYY") : "Not Set"}
                  </div>
                  <div>
                    <b>Current Stage:</b> {jobCardOrder.productionStage || PRODUCTION_STAGES[0]}
                  </div>
                </div>
              </div>

              {/* Window Items Specifications Table */}
              <div style={{ marginBottom: "18px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", border: "1px solid #cbd5e1" }}>
                  <thead>
                    <tr style={{ background: "#103567", color: "#ffffff", textAlign: "left" }}>
                      <th style={{ padding: "8px", width: "35px", textAlign: "center", color: "#fff" }}>#</th>
                      <th style={{ padding: "8px", color: "#fff" }}>Window Description / Profile Series</th>
                      <th style={{ padding: "8px", width: "90px", textAlign: "center", color: "#fff" }}>Width (mm)</th>
                      <th style={{ padding: "8px", width: "90px", textAlign: "center", color: "#fff" }}>Height (mm)</th>
                      <th style={{ padding: "8px", width: "85px", textAlign: "center", color: "#fff" }}>Unit Sq.Ft</th>
                      <th style={{ padding: "8px", width: "55px", textAlign: "center", color: "#fff" }}>Qty</th>
                      <th style={{ padding: "8px", width: "95px", textAlign: "right", color: "#fff" }}>Total Sq.Ft</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(jobCardOrder.items) && jobCardOrder.items.length > 0 ? (
                      jobCardOrder.items.map((item, i) => {
                        const qty = Number(item.quantity) || 1;
                        const sqFt = Number(item.sqFt) || 0;
                        const lineTotalSqFt = sqFt * qty;

                        return (
                          <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: "8px", textAlign: "center", fontWeight: 600 }}>{i + 1}</td>
                            <td style={{ padding: "8px", fontWeight: 600, color: "#1e293b" }}>
                              {item.description || "Window Unit"}
                              {item.productCode && (
                                <span style={{ color: "#64748b", fontWeight: 400, marginLeft: "6px" }}>
                                  ({item.productCode})
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "8px", textAlign: "center" }}>
                              {Number(item.width) > 0 ? item.width : "-"}
                            </td>
                            <td style={{ padding: "8px", textAlign: "center" }}>
                              {Number(item.height) > 0 ? item.height : "-"}
                            </td>
                            <td style={{ padding: "8px", textAlign: "center" }}>
                              {sqFt > 0 ? sqFt.toFixed(2) : "-"}
                            </td>
                            <td style={{ padding: "8px", textAlign: "center", fontWeight: 700, color: "#103567" }}>
                              {qty}
                            </td>
                            <td style={{ padding: "8px", textAlign: "right", fontWeight: 700 }}>
                              {lineTotalSqFt > 0 ? lineTotalSqFt.toFixed(2) : "-"}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="7" style={{ padding: "14px", textAlign: "center", color: "#64748b" }}>
                          No specific line items recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    {Array.isArray(jobCardOrder.items) && jobCardOrder.items.length > 0 && (
                      <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "2px solid #cbd5e1" }}>
                        <td colSpan="5" style={{ padding: "8px", textAlign: "right" }}>
                          TOTAL FABRICATION SUMMARY:
                        </td>
                        <td style={{ padding: "8px", textAlign: "center", color: "#103567" }}>
                          {jobCardOrder.items.reduce((s, it) => s + (Number(it.quantity) || 1), 0)} Units
                        </td>
                        <td style={{ padding: "8px", textAlign: "right", color: "#103567" }}>
                          {jobCardOrder.items
                            .reduce((s, it) => s + (Number(it.sqFt) || 0) * (Number(it.quantity) || 1), 0)
                            .toFixed(2)}{" "}
                          Sq.Ft
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>

              {/* ── Dynamic Workshop Notes & Dynamic Quality Inspection Sign-off ── */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1.1fr",
                  gap: "14px",
                  marginTop: "16px",
                  fontSize: "11px",
                }}
              >
                {/* 1. Dynamic FABRICATION & WORKSHOP NOTES */}
                <div
                  style={{
                    border: "1px dashed #cbd5e1",
                    padding: "12px",
                    borderRadius: "8px",
                    background: "#fcfcfc",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <div style={{ fontWeight: 700, color: "#103567", fontSize: "11px", letterSpacing: "0.4px" }}>
                        FABRICATION &amp; WORKSHOP NOTES:
                      </div>
                      <div className="no-print">
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: "2px 8px", fontSize: "10px", height: "auto" }}
                          onClick={() => setIsEditingNotes(!isEditingNotes)}
                        >
                          {isEditingNotes ? "👁 Preview" : "✏ Edit Notes"}
                        </button>
                      </div>
                    </div>

                    {/* Interactive Textarea in UI */}
                    {isEditingNotes ? (
                      <div className="no-print" style={{ marginTop: "4px" }}>
                        <textarea
                          rows={4}
                          value={jobCardNotes}
                          onChange={(e) => setJobCardNotes(e.target.value)}
                          placeholder="Enter fabrication instructions, glass specifications, reinforcement rules..."
                          style={{
                            width: "100%",
                            padding: "8px",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            fontSize: "11px",
                            fontFamily: "inherit",
                            lineHeight: 1.4,
                          }}
                        />
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
                          <button
                            type="button"
                            className="btn primary"
                            style={{ padding: "4px 10px", fontSize: "11px" }}
                            onClick={handleSaveJobCardDetails}
                            disabled={savingJobCard}
                          >
                            {savingJobCard ? "Saving..." : "💾 Save Notes"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p
                        className="no-print"
                        style={{ margin: 0, color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: "11px" }}
                      >
                        {jobCardNotes || "No specific fabrication notes provided."}
                      </p>
                    )}

                    {/* Always visible on print */}
                    <p
                      className="print-only"
                      style={{ margin: 0, color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: "11px" }}
                    >
                      {jobCardNotes || "No specific fabrication notes provided."}
                    </p>
                  </div>

                  <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "8px", borderTop: "1px solid #f1f5f9", paddingTop: "4px" }}>
                    Prominance Lead-Free uPVC Standard Guidelines
                  </div>
                </div>

                {/* 2. Dynamic QUALITY INSPECTION SIGN-OFF */}
                <div
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "12px",
                    borderRadius: "8px",
                    background: "#f8fafc",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <div style={{ fontWeight: 700, color: "#103567", fontSize: "11px", letterSpacing: "0.4px" }}>
                        QUALITY INSPECTION SIGN-OFF:
                      </div>
                      <div className="no-print">
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: "2px 8px", fontSize: "10px", height: "auto" }}
                          onClick={() => setIsEditingSignOff(!isEditingSignOff)}
                        >
                          {isEditingSignOff ? "👁 Preview" : "✏ Sign &amp; Date"}
                        </button>
                      </div>
                    </div>

                    {/* Edit Sign-off Form */}
                    {isEditingSignOff && (
                      <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px" }}>
                        <div>
                          <label style={{ fontSize: "10px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "1px" }}>
                            Supervisor Name / Signatory
                          </label>
                          <input
                            type="text"
                            value={jobCardSupervisor}
                            onChange={(e) => setJobCardSupervisor(e.target.value)}
                            placeholder="Supervisor name"
                            style={{ width: "100%", padding: "5px 8px", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "11px" }}
                          />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                          <div>
                            <label style={{ fontSize: "10px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "1px" }}>
                              Inspection Date
                            </label>
                            <input
                              type="date"
                              value={jobCardDate}
                              onChange={(e) => setJobCardDate(e.target.value)}
                              style={{ width: "100%", padding: "5px 8px", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "11px" }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: "10px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "1px" }}>
                              Sign-off Status
                            </label>
                            <select
                              value={jobCardStatus}
                              onChange={(e) => setJobCardStatus(e.target.value)}
                              style={{ width: "100%", padding: "5px 8px", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "11px" }}
                            >
                              <option value="Passed & Approved">Passed &amp; Approved</option>
                              <option value="In Inspection">In Inspection</option>
                              <option value="Pending">Pending</option>
                              <option value="Rework Needed">Rework Needed</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                          <button
                            type="button"
                            className="btn primary"
                            style={{ padding: "4px 10px", fontSize: "11px" }}
                            onClick={handleSaveJobCardDetails}
                            disabled={savingJobCard}
                          >
                            {savingJobCard ? "Saving..." : "💾 Save Sign-off"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Dynamic Official Quality Inspection Stamp Badge */}
                    <div style={{ marginTop: "4px", marginBottom: "10px" }}>
                      {jobCardStatus === "Passed & Approved" ? (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            background: "#e5f7ef",
                            color: "#16845b",
                            border: "1px solid #86efac",
                            fontWeight: 800,
                            fontSize: "10px",
                          }}
                        >
                          <span>✓</span> QUALITY INSPECTED &amp; APPROVED
                        </div>
                      ) : jobCardStatus === "Rework Needed" ? (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            background: "#fde9eb",
                            color: "#b93b45",
                            border: "1px solid #fca5a5",
                            fontWeight: 800,
                            fontSize: "10px",
                          }}
                        >
                          <span>⚠️</span> REWORK REQUIRED
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            background: "#fff3dc",
                            color: "#9a670e",
                            border: "1px solid #fde68a",
                            fontWeight: 800,
                            fontSize: "10px",
                          }}
                        >
                          <span>⏳</span> {jobCardStatus.toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dynamic Supervisor Signature & Date Row */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-end",
                      borderTop: "1px dashed #cbd5e1",
                      paddingTop: "6px",
                      marginTop: "6px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "15px",
                          fontFamily: "cursive, 'Brush Script MT', sans-serif",
                          color: "#103567",
                          fontWeight: 700,
                          lineHeight: 1.2,
                        }}
                      >
                        ✍ {jobCardSupervisor || "Supervisor Sign"}
                      </div>
                      <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", marginTop: "2px" }}>
                        Supervisor Signature
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b", lineHeight: 1.2 }}>
                        {jobCardDate ? dayjs(jobCardDate).format("DD/MM/YYYY") : dayjs().format("DD/MM/YYYY")}
                      </div>
                      <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", marginTop: "2px" }}>
                        Inspection Date
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
