import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./Sidebar.css"; // will create simple CSS using theme vars

const groups = [
  { title: "OVERVIEW", items: [["Dashboard","▦"],["Admin Panel","⌘"],["CRM & Customers","♙"],["Quotations & Costing","▤"],["Proforma Invoice","▧"],["Sales & Orders","▣"]] },
  { title: "OPERATIONS", items: [["Production","⚙"],["Purchases & Suppliers","⇄"]] },
  { title: "FINANCE", items: [["Invoices & Payments","▧"],["Expenses & Accounts","₹"]] },
  { title: "PEOPLE", items: [["Employees","♧"],["Attendance & Leave","◷"],["Payroll & Salary","₹"],["Advance Payment","₹"]] },
  { title: "MANAGEMENT", items: [["Tasks & Approvals","☑"],["Users & Permissions","♙"],["Settings & Integrations","⚙"]] }
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const go = (page) => {
    const routeMap = {
      "Dashboard": "/",
      "Admin Panel": "/admin",
      "CRM & Customers": "/customers",
      "Quotations & Costing": "/quotations",
      "Proforma Invoice": "/proforma",
      "Sales & Orders": "/sales",
      "Production": "/production",
      "Purchases & Suppliers": "/purchases",
      "Invoices & Payments": "/invoices",
      "Expenses & Accounts": "/expenses",
      "Employees": "/employees",
      "Attendance & Leave": "/attendance",
      "Payroll & Salary": "/payroll",
      "Advance Payment": "/advance-payment",
      "Tasks & Approvals": "/tasks",
      "Users & Permissions": "/users",
      "Settings & Integrations": "/settings"
    };
    const path = routeMap[page] || "/";
    navigate(path);
  };

  useEffect(() => {
    // close mobile sidebar if open on navigation change
    const sidebar = document.getElementById("sidebar");
    if (sidebar && sidebar.classList.contains("open")) sidebar.classList.remove("open");
  }, [location.pathname]);

  return (
    <aside className="sidebar" id="sidebar">
      <div className="brand">
        <div className="logo">D</div>
        <div>
          <b>DD UPVC</b>
          <small>WINDOWS SYSTEM ERP</small>
        </div>
      </div>
      <nav className="navgroup-container">
        {groups.map((g, gi) => (
          <div className="navgroup" key={gi}>
            <div className="navtitle">{g.title}</div>
            {g.items.map(([name, ico]) => (
              <button
                key={name}
                className={`navitem ${location.pathname === mapPath(name) ? "active" : ""}`}
                onClick={() => go(name)}
              >
                <span className="ico">{ico}</span>
                <span>{name}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidefoot">
        <b>DD UPVC</b>
        <div>Business operations, connected.</div>
      </div>
    </aside>
  );
}

function mapPath(name) {
  const map = {
    "Dashboard": "/",
    "Admin Panel": "/admin",
    "Employees": "/employees",
    "Attendance & Leave": "/attendance",
    "Payroll & Salary": "/payroll",
    "Advance Payment": "/advance-payment",
    // add others as needed
  };
  return map[name] || "/";
}

