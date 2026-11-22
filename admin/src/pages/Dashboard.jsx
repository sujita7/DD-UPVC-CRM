import React from "react";
import { useNavigate } from "react-router-dom";

const barData = [
  { label: "May", h: 42 }, { label: "Jun", h: 58 }, { label: "Jul", h: 48 },
  { label: "Aug", h: 68 }, { label: "Sep", h: 61 }, { label: "Oct", h: 84 },
  { label: "May", h: 74 }, { label: "Jun", h: 95 }, { label: "Jul", h: 79 },
  { label: "Aug", h: 100 }, { label: "Sep", h: 88 }, { label: "Oct", h: 112 },
];

const pipelineData = [
  { label: "New enquiries", count: 18, pct: 80, color: "#3978f6" },
  { label: "Quotation sent", count: 12, pct: 62, color: "#5c8ef4" },
  { label: "Confirmed", count: 9, pct: 45, color: "#36a887" },
  { label: "In production", count: 8, pct: 40, color: "#e2a13a" },
  { label: "Installation", count: 7, pct: 35, color: "#8b70dc" },
];

const recentOrders = [
  ["ORD-1024", "Rajesh Sharma", "₹85,000", "In Production"],
  ["ORD-1025", "Global Infra", "₹42,000", "Installation"],
  ["ORD-1026", "Sunrise Builders", "₹1,25,000", "Confirmed"],
  ["ORD-1027", "Patel Properties", "₹76,500", "Ready to Dispatch"],
];

const priorities = [
  { text: "Follow up on overdue invoice INV-1003", sub: "Finance · High priority" },
  { text: "Approve glass supplier purchase order", sub: "Purchasing · Normal" },
  { text: "Confirm installation schedule for Pune site", sub: "Installation · Today" },
];

function pillColor(s) {
  const x = s.toLowerCase();
  if (/paid|active|approved|received|present|completed|in stock|ready/.test(x)) return "green";
  if (/overdue|absent|low stock|rejected/.test(x)) return "red";
  if (/progress|sent|part|scheduled|quality|follow-up|pending|draft|queued|leave|confirmed/.test(x)) return "amber";
  return "blue";
}

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <>
      <div className="crumb">DD UPVC <span style={{ margin: "0 6px" }}>/</span> DASHBOARD</div>
      <div className="pagehead">
        <div>
          <h1>Dashboard</h1>
          <p>A clear view of sales, collections, active orders and operations.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid stats">
        <div className="card stat">
          <div className="statrow"><span>Sales this month</span><span className="staticon">↗</span></div>
          <strong>₹8,45,000</strong>
          <span className="trend">↑ 12.4% vs last month</span>
        </div>
        <div className="card stat">
          <div className="statrow"><span>Outstanding dues</span><span className="staticon">₹</span></div>
          <strong>₹2,15,000</strong>
          <span className="trend">12 invoices need follow-up</span>
        </div>
        <div className="card stat">
          <div className="statrow"><span>Active orders</span><span className="staticon">▣</span></div>
          <strong>24</strong>
          <span className="trend">8 orders in production</span>
        </div>
        <div className="card stat">
          <div className="statrow"><span>Installations pending</span><span className="staticon">⌁</span></div>
          <strong>7</strong>
          <span className="trend">3 scheduled this week</span>
        </div>
      </div>

      {/* Revenue chart + Order pipeline */}
      <div className="grid two">
        <div className="card">
          <div className="cardhead">
            <div>
              <h2>Revenue overview</h2>
              <small className="muted">Monthly sales performance</small>
            </div>
            <select className="btn" style={{ fontSize: 11 }}>
              <option>Last 6 months</option>
              <option>This year</option>
            </select>
          </div>
          <div className="cardbody">
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <strong style={{ fontSize: 26 }}>₹8.45L</strong>
              <span className="trend">↑ 12.4%</span>
            </div>
            <div className="chart">
              {barData.map((b, i) => (
                <div className="barcol" key={i}>
                  <div className="bars" style={{ height: b.h + "px" }}></div>
                  <small>{b.label}</small>
                </div>
              ))}
            </div>
            <div className="legend">
              <span><i className="dot"></i>Revenue</span>
              <span><i className="dot dot2"></i>Previous period</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="cardhead">
            <h2>Order pipeline</h2>
            <button className="btn" onClick={() => navigate("/sales")}>View orders ↗</button>
          </div>
          <div className="cardbody">
            {pipelineData.map((p, i) => (
              <div key={i} style={{ marginBottom: 19 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12 }}>
                  <span>{p.label}</span><b>{p.count}</b>
                </div>
                <div className="progress">
                  <span style={{ width: p.pct + "%", background: p.color }}></span>
                </div>
              </div>
            ))}
            <div style={{ paddingTop: 3, color: "#7b8799", fontSize: 11 }}>
              Pipeline figures are illustrative sample data.
            </div>
          </div>
        </div>
      </div>

      {/* Recent orders + Priorities */}
      <div className="grid two" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="cardhead">
            <h2>Recent orders</h2>
            <button className="btn" onClick={() => navigate("/sales")}>View all ↗</button>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Order</th><th>Customer</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {recentOrders.map((r, i) => (
                  <tr key={i}>
                    <td><b>{r[0]}</b></td>
                    <td>{r[1]}</td>
                    <td>{r[2]}</td>
                    <td><span className={`pill ${pillColor(r[3])}`}>{r[3]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="cardhead">
            <h2>Today's priorities</h2>
            <span className="pill blue">3 tasks</span>
          </div>
          <div className="cardbody">
            {priorities.map((p, i) => (
              <label className="task" key={i}>
                <input type="checkbox" />
                <span>
                  <b>{p.text}</b>
                  <small>{p.sub}</small>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
