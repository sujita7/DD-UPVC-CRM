import React from "react";
import { useNavigate } from "react-router-dom";

const adminControls = [
  ["User & role management", "Invite employees, set module permissions", "♙"],
  ["Company profile & tax", "Legal name, GSTIN, invoice numbering", "⚙"],
  ["Approval workflows", "Set who approves quotes, expenses and leave", "✓"],
  ["Audit & activity log", "Review edits, approvals and user actions", "◷"],
];

export default function AdminPanel() {
  const navigate = useNavigate();

  return (
    <>
      <div className="crumb">DD UPVC <span style={{ margin: "0 6px" }}>/</span> ADMIN PANEL</div>
      <div className="pagehead">
        <div>
          <h1>Admin Panel</h1>
          <p>Owner-level control for users, business settings, approvals and workforce operations.</p>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => navigate("/users")}>＋ Invite user</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid stats">
        <div className="card stat">
          <div className="statrow"><span>Active users</span><span className="staticon">♙</span></div>
          <strong>12</strong>
          <span className="trend">Across 5 role groups</span>
        </div>
        <div className="card stat">
          <div className="statrow"><span>Pending approvals</span><span className="staticon">✓</span></div>
          <strong>6</strong>
          <span className="trend">Quotes, purchases and leave</span>
        </div>
        <div className="card stat">
          <div className="statrow"><span>Attendance today</span><span className="staticon">◷</span></div>
          <strong>11 / 12</strong>
          <span className="trend">1 absent · sample data</span>
        </div>
        <div className="card stat">
          <div className="statrow"><span>Payroll this month</span><span className="staticon">₹</span></div>
          <strong>₹1,14,000</strong>
          <span className="trend">3 salary records · illustrative</span>
        </div>
      </div>

      {/* Admin controls + Quick actions */}
      <div className="grid two">
        <div className="card">
          <div className="cardhead">
            <h2>Admin controls</h2>
            <span className="pill blue">Owner access</span>
          </div>
          <div className="cardbody">
            <div className="grid sectiongrid">
              {adminControls.map(([title, desc, ico], i) => (
                <div className="card feature" key={i}>
                  <div className="featureicon">{ico}</div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                  <button className="btn">Configure ↗</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="cardhead">
            <h2>Admin quick actions</h2>
          </div>
          <div className="cardbody" style={{ display: "grid", gap: 10 }}>
            <button className="btn" onClick={() => navigate("/users")}>＋ Invite a user</button>
            <button className="btn" onClick={() => navigate("/attendance")}>◷ Review attendance</button>
            <button className="btn" onClick={() => navigate("/payroll")}>₹ Review monthly payroll</button>
            <button className="btn" onClick={() => navigate("/settings")}>⚙ Company settings</button>
            <p className="muted" style={{ fontSize: 11 }}>
              Role permissions, audit trails, backups and approval rules must be enforced by the backend—not only by hiding UI elements.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

