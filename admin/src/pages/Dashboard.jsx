import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Spin, message } from "antd";
import { dashboardAPI, taskAPI } from "../services/api";

function pillColor(s) {
  const x = (s || "").toLowerCase();
  if (/paid|active|approved|received|present|completed|in stock|ready|settle/.test(x) && !/unpaid|due|part/.test(x)) return "green";
  if (/overdue|absent|low stock|rejected|cancelled/.test(x)) return "red";
  if (/progress|sent|part|scheduled|quality|follow-up|pending|draft|queued|leave|confirmed|tentative/.test(x)) return "amber";
  return "blue";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("Last 6 months");
  const [stats, setStats] = useState({
    salesThisMonth: 0,
    salesGrowth: 12.4,
    outstandingDues: 0,
    dueInvoicesCount: 0,
    activeOrdersCount: 0,
    ordersInProductionCount: 0,
    installationsPendingCount: 0,
  });
  const [barData, setBarData] = useState([]);
  const [pipelineData, setPipelineData] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [priorities, setPriorities] = useState([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await dashboardAPI.getStats();
      if (res.data?.ok || res.data?.stats) {
        const d = res.data;
        if (d.stats) setStats(d.stats);
        if (Array.isArray(d.barData) && d.barData.length > 0) setBarData(d.barData);
        if (Array.isArray(d.pipelineData) && d.pipelineData.length > 0) setPipelineData(d.pipelineData);
        if (Array.isArray(d.recentOrders)) setRecentOrders(d.recentOrders);
        if (Array.isArray(d.priorities)) setPriorities(d.priorities);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      message.error("Could not load latest dashboard stats.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleToggleTask = async (taskId, currentStatus) => {
    const nextStatus = currentStatus === "completed" ? "pending" : "completed";
    try {
      await taskAPI.update(taskId, { status: nextStatus });
      message.success(nextStatus === "completed" ? "Task marked as completed!" : "Task reopened.");
      setPriorities((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
      );
    } catch (err) {
      message.error("Failed to update task status.");
    }
  };

  const formattedSalesLakhs =
    stats.salesThisMonth >= 100000
      ? `₹${(stats.salesThisMonth / 100000).toFixed(2)}L`
      : `₹${Number(stats.salesThisMonth).toLocaleString("en-IN")}`;

  return (
    <>
      <div className="crumb">
        DD UPVC <span style={{ margin: "0 6px" }}>/</span> DASHBOARD
      </div>
      <div className="pagehead">
        <div>
          <h1>Dashboard</h1>
          <p>A clear, real-time view of sales, collections, active orders and workshop operations.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={fetchDashboardData} title="Refresh real-time metrics">
            ⟳ Refresh Data
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
          <Spin size="large" />
          <p className="muted" style={{ marginTop: 12 }}>Loading live operations &amp; business metrics…</p>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid stats">
            <div className="card stat">
              <div className="statrow">
                <span>Sales this month</span>
                <span className="staticon">↗</span>
              </div>
              <strong>₹{Number(stats.salesThisMonth || 0).toLocaleString("en-IN")}</strong>
              <span className="trend" style={{ color: stats.salesGrowth >= 0 ? "var(--green)" : "var(--red)" }}>
                {stats.salesGrowth >= 0 ? "↑" : "↓"} {Math.abs(stats.salesGrowth)}% vs prior period
              </span>
            </div>

            <div className="card stat">
              <div className="statrow">
                <span>Outstanding dues</span>
                <span className="staticon">₹</span>
              </div>
              <strong>₹{Number(stats.outstandingDues || 0).toLocaleString("en-IN")}</strong>
              <span className="trend" style={{ color: stats.outstandingDues > 0 ? "var(--amber)" : "var(--green)" }}>
                {stats.dueInvoicesCount} invoices need follow-up
              </span>
            </div>

            <div className="card stat">
              <div className="statrow">
                <span>Active orders</span>
                <span className="staticon">▣</span>
              </div>
              <strong>{stats.activeOrdersCount || 0}</strong>
              <span className="trend">
                {stats.ordersInProductionCount || 0} orders in production
              </span>
            </div>

            <div className="card stat">
              <div className="statrow">
                <span>Ready / Dispatching</span>
                <span className="staticon">⌁</span>
              </div>
              <strong>{stats.installationsPendingCount || 0}</strong>
              <span className="trend" style={{ color: "var(--blue)" }}>
                Scheduled for dispatch &amp; delivery
              </span>
            </div>
          </div>

          {/* Revenue chart + Order pipeline */}
          <div className="grid two">
            <div className="card">
              <div className="cardhead">
                <div>
                  <h2>Revenue overview</h2>
                  <small className="muted">Live monthly billing &amp; sales performance</small>
                </div>
                <select
                  className="btn"
                  style={{ fontSize: 11 }}
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                >
                  <option>Last 6 months</option>
                  <option>This year</option>
                </select>
              </div>
              <div className="cardbody">
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <strong style={{ fontSize: 26 }}>{formattedSalesLakhs}</strong>
                  <span className="trend" style={{ color: stats.salesGrowth >= 0 ? "var(--green)" : "var(--red)" }}>
                    {stats.salesGrowth >= 0 ? "↑" : "↓"} {Math.abs(stats.salesGrowth)}%
                  </span>
                </div>
                <div className="chart">
                  {barData.length > 0
                    ? barData.map((b, i) => (
                        <div className="barcol" key={i} title={`${b.label}: ₹${Number(b.amount || 0).toLocaleString("en-IN")}`}>
                          <div className="bars" style={{ height: Math.max(16, b.h) + "px" }}></div>
                          <small>{b.label}</small>
                        </div>
                      ))
                    : [
                        { label: "Jun", h: 45 },
                        { label: "Jul", h: 60 },
                        { label: "Aug", h: 55 },
                        { label: "Sep", h: 75 },
                        { label: "Oct", h: 90 },
                        { label: "Nov", h: 105 },
                      ].map((b, i) => (
                        <div className="barcol" key={i}>
                          <div className="bars" style={{ height: b.h + "px" }}></div>
                          <small>{b.label}</small>
                        </div>
                      ))}
                </div>
                <div className="legend">
                  <span>
                    <i className="dot"></i>Current Orders &amp; Billing
                  </span>
                  <span>
                    <i className="dot dot2"></i>Previous baseline
                  </span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="cardhead">
                <h2>Order pipeline</h2>
                <button className="btn" onClick={() => navigate("/sales")}>
                  View orders ↗
                </button>
              </div>
              <div className="cardbody">
                {pipelineData.map((p, i) => (
                  <div key={i} style={{ marginBottom: 19 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12 }}>
                      <span>{p.label}</span>
                      <b>{p.count}</b>
                    </div>
                    <div className="progress">
                      <span style={{ width: Math.max(8, p.pct) + "%", background: p.color }}></span>
                    </div>
                  </div>
                ))}
                <div style={{ paddingTop: 3, color: "#7b8799", fontSize: 11 }}>
                  Calculated dynamically from active quotations, workshop production, and dispatched orders.
                </div>
              </div>
            </div>
          </div>

          {/* Recent orders + Priorities */}
          <div className="grid two" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="cardhead">
                <h2>Recent orders</h2>
                <button className="btn" onClick={() => navigate("/sales")}>
                  View all ↗
                </button>
              </div>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.length > 0 ? (
                      recentOrders.map((r, i) => (
                        <tr
                          key={r.id || i}
                          style={{ cursor: "pointer" }}
                          onClick={() => navigate("/sales")}
                          title="Click to view sales order details"
                        >
                          <td>
                            <b style={{ color: "#103567" }}>{r.orderNumber}</b>
                          </td>
                          <td>{r.customerName}</td>
                          <td>
                            <b>₹{Number(r.totalAmount || 0).toLocaleString("en-IN")}</b>
                          </td>
                          <td>
                            <span className={`pill ${pillColor(r.status)}`}>
                              {r.status ? r.status.replace("-", " ").toUpperCase() : "CONFIRMED"}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                          No recent orders found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="cardhead">
                <h2>Today's priorities &amp; Tasks</h2>
                <button className="btn" onClick={() => navigate("/tasks")} style={{ padding: "3px 8px", fontSize: 11 }}>
                  Manage Tasks ↗
                </button>
              </div>
              <div className="cardbody">
                {priorities.length > 0 ? (
                  priorities.map((p, i) => {
                    const isDone = p.status === "completed";
                    return (
                      <label
                        className="task"
                        key={p.id || i}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: "8px 0",
                          borderBottom: i < priorities.length - 1 ? "1px solid var(--line)" : "none",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => handleToggleTask(p.id, p.status)}
                          style={{ marginTop: 3 }}
                        />
                        <span style={{ textDecoration: isDone ? "line-through" : "none", color: isDone ? "#94a3b8" : "inherit" }}>
                          <b style={{ display: "block", fontSize: 13, color: isDone ? "#94a3b8" : "#0f172a" }}>
                            {p.text}
                          </b>
                          <small className="muted" style={{ fontSize: 11 }}>
                            {p.sub}
                          </small>
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <p className="muted" style={{ padding: 12, textAlign: "center" }}>
                    No pending priorities today.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
