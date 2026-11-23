import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import logoImg from "../../public/ddupvc-logo.jpeg";

const groups = [
  { title: "OVERVIEW", items: [["Dashboard","▦","/dashboard"],["Admin Panel","⌘","/admin"]] },
  { title: "COMMERCIAL", items: [["CRM & Customers","♙","/customers"],["Quotations & Costing","▤","/quotations"],["Sales & Orders","▣","/sales"],["Proforma Invoice","▧","/proforma"]] },
  { title: "OPERATIONS", items: [["Production","⚙","/production"],["Purchases & Suppliers","⇄","/suppliers"]] },
  { title: "FINANCE", items: [["Invoices & Payments","▧","/invoices"],["Expenses & Accounts","₹","/expenses"]] },
  { title: "PEOPLE", items: [["Employees","♧","/employees"],["Attendance & Leave","◷","/attendance"],["Payroll & Salary","₹","/payroll"],["Advance Payment","₹","/advance-payment"]] },
  { title: "MANAGEMENT", items: [["Tasks & Approvals","☑","/tasks"],["Settings & Integrations","⚙","/settings"]] }
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try { await logout(); navigate("/login"); } catch(e) { console.error(e); }
  };

  const getInitials = (name) => {
    if (!name) return "AD";
    return name.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();
  };

  const isActive = (path) => {
    if (path === "/dashboard") return location.pathname === "/dashboard" || location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className={`sidebar${sidebarOpen ? " open" : ""}`} id="sidebar">
        <div className="brand">
          <div className="logo"><img src={logoImg} alt="DD UPVC Logo" onError={(e) => { e.currentTarget.src = "/ddupvc-logo.png"; }} /></div>
          <div>
            <b>DD UPVC</b>  
            <small>WINDOWS SYSTEM ERP</small>
          </div>
        </div>
        <nav>
          {groups.map((g, gi) => (
            <div className="navgroup" key={gi}>
              <div className="navtitle">{g.title}</div>
              {g.items.map(([name, ico, path]) => (
                <button
                  key={name}
                  className={`navitem${isActive(path) ? " active" : ""}`}
                  onClick={() => { navigate(path); setSidebarOpen(false); }}
                >
                  <span className="ico">{ico}</span>
                  <span>{name}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidefoot">
          <b>DD UPVC Workspace</b>
          Business operations, connected.
          <div style={{ marginTop: 10, color: "#7f96b1" }}>● All systems operational</div>
        </div>
      </aside>

      {/* ── Main Area ── */}
      <div className="main-area">
        {/* Top Bar */}
        <header className="topbar">
          <button
            className="iconbtn mobilemenu"
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="Open menu"
          >☰</button>
          <div className="search">
            <span>⌕</span>
            <input placeholder="Search customers, orders, invoices…" aria-label="Search" />
          </div>
          <div className="topright">
            <div style={{ position: "relative" }}>
              <div
                className="profile"
                style={{ cursor: "pointer" }}
                onClick={() => setUserMenuOpen(v => !v)}
              >
                <div className="avatar">{getInitials(admin?.name)}</div>
                <div>
                  <b>{admin?.name || "Admin"}</b>
                  <small>{admin?.role === "superadmin" ? "Workspace admin" : admin?.role || "Admin"}</small>
                </div>
              </div>
              {userMenuOpen && (
                <div className="user-menu" onMouseLeave={() => setUserMenuOpen(false)}>
                  <button onClick={() => { setUserMenuOpen(false); navigate("/dashboard"); }}>Dashboard</button>
                  <button onClick={() => { setUserMenuOpen(false); navigate("/settings"); }}>Settings</button>
                  <button className="danger" onClick={() => { setUserMenuOpen(false); handleLogout(); }}>Sign Out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
