import React from "react";

const moduleFeatures = {
  "Sales & Orders": [
    ["Order tracking", "Track orders from confirmation to delivery", "▣"],
    ["Order history", "Review past orders and customer activity", "▤"],
    ["Order analytics", "Completion rates, delays and revenue breakdown", "▥"],
  ],
  "Proforma Invoice": [
    ["Create proforma", "Draft preliminary invoices before tax invoice", "▧"],
    ["Customer approvals", "Share proforma and track client acceptance", "✓"],
    ["Convert to invoice", "Convert approved proforma to final tax invoice", "₹"],
  ],
  "Production": [
    ["Job cards", "Create production jobs from confirmed orders", "▤"],
    ["Cutting & fabrication", "Cut lists, profile optimisation and wastage", "⚙"],
    ["Quality control", "Inspection, defects, rework and sign-off", "✓"],
  ],
  "Inventory & Stock": [
    ["Material catalogue", "Profiles, glass, hardware and accessories", "▦"],
    ["Stock movement", "Receipts, issue, transfers and adjustments", "⇄"],
    ["Reorder planning", "Minimum levels and supplier replenishment", "↗"],
  ],
  "Delivery & Installation": [
    ["Dispatch planning", "Delivery challans, vehicle and route", "⇢"],
    ["Installation calendar", "Assign teams and book site visits", "◷"],
    ["Warranty & service", "Snag lists, complaints and follow-ups", "✓"],
  ],
  "Expenses & Accounts": [
    ["Expense register", "Record operating and project expenses", "₹"],
    ["Cash & bank", "Track receipts, payments and transfers", "▣"],
    ["Receivables & payables", "Outstanding balances and ageing", "↗"],
  ],
  "Reports & Analytics": [
    ["Sales performance", "Revenue by period, customer and product", "▥"],
    ["Margin & costing", "Material cost, labour, wastage and margin", "₹"],
    ["Operations performance", "Production throughput, delays and quality", "⚙"],
  ],
  "Tasks & Approvals": [
    ["Approval inbox", "Quotes, purchases, expenses and leave", "✓"],
    ["Task assignment", "Owners, due dates and priorities", "☑"],
    ["Audit history", "Who changed or approved each record", "◷"],
  ],
  "Documents & Warranty": [
    ["Document library", "Invoices, quotations and delivery proof", "▤"],
    ["Warranty register", "Products, coverage and expiry dates", "✓"],
    ["Service tickets", "Complaints, repairs and closure tracking", "⚙"],
  ],
  "Users & Permissions": [
    ["Roles", "Owner, sales, accounts, factory, HR and installer", "♙"],
    ["Permissions", "Module-level read, create, edit and approve", "◈"],
    ["Security log", "Sign-ins, changes and sensitive actions", "▣"],
  ],
};

export default function GenericModule({ module, desc }) {
  const features = moduleFeatures[module] || [
    ["Feature 1", "Coming soon", "▦"],
    ["Feature 2", "Coming soon", "⚙"],
    ["Feature 3", "Coming soon", "✓"],
  ];

  return (
    <>
      <div className="crumb">DD UPVC <span style={{ margin: "0 6px" }}>/</span> {module.toUpperCase()}</div>
      <div className="pagehead">
        <div>
          <h1>{module}</h1>
          <p>{desc}</p>
        </div>
        <div className="actions">
          <button className="btn">⇩ Export</button>
          <button className="btn primary">＋ Create</button>
        </div>
      </div>

      <div className="grid sectiongrid">
        {features.map(([title, description, ico], i) => (
          <div className="card feature" key={i}>
            <div className="featureicon">{ico}</div>
            <h3>{title}</h3>
            <p>{description}</p>
            <button className="btn">Open module ↗</button>
          </div>
        ))}
      </div>
    </>
  );
}

