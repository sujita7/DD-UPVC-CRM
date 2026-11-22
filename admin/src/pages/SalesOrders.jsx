import React, { useState, useEffect } from "react";
import { App } from "antd";
import dayjs from "dayjs";
import { salesOrderAPI, customerAPI, productAPI } from "../services/api";

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
  return <span className={`pill ${c}`}>{s ? s.replace("-", " ").toUpperCase() : "CONFIRMED"}</span>;
}

function fulfillmentMeasurementPill(m) {
  const val = (m || "tentative").toLowerCase();
  if (val === "final") {
    return <span className="pill green">FINAL</span>;
  }
  return <span className="pill amber">TENTATIVE</span>;
}

export default function SalesOrders() {
  const { message } = App.useApp();
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // In-Page View Mode: "list" (register table) or "form" (dedicated full-page editor/viewer)
  const [viewMode, setViewMode] = useState("list");
  const [editingOrder, setEditingOrder] = useState(null);

  // Quick category filter for adding line items
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [form, setForm] = useState({
    customerId: "",
    projectName: "",
    orderDate: dayjs().format("YYYY-MM-DD"),
    deliveryDate: dayjs().add(30, "day").format("YYYY-MM-DD"),
    status: "confirmed",
    fulfillmentMeasurement: "tentative",
    advancePaid: 35000,
    notes: "",
    lineItems: [
      {
        productId: "",
        productCode: "WIN-3TRK-INV",
        description: "3 TRACK WINDOW",
        width: 1785,
        height: 2018,
        sqFt: 39.63,
        quantity: 1,
        unitPrice: 690,
        total: 27344.7,
      },
    ],
  });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await salesOrderAPI.list({ limit: 500 });
      setOrders(res.data?.orders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await customerAPI.list({ limit: 100 });
      setCustomers(res.data?.customers || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await productAPI.list({ limit: 300 });
      setProducts(res.data?.products || []);
    } catch (err) {
      console.error("Failed to load products catalogue", err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
    fetchProducts();
  }, []);

  const handleOpenCreate = () => {
    setEditingOrder(null);
    setForm({
      customerId: customers[0]?._id || "",
      projectName: "Villa Window Installation",
      orderDate: dayjs().format("YYYY-MM-DD"),
      deliveryDate: dayjs().add(30, "day").format("YYYY-MM-DD"),
      status: "confirmed",
      fulfillmentMeasurement: "tentative",
      advancePaid: 0,
      notes: "Fabrication according to verified Prominance uPVC specifications. FOR delivery basis.",
      lineItems: [
        {
          productId: "",
          productCode: "WIN-3TRK-INV",
          description: "3 TRACK WINDOW",
          width: 1785,
          height: 2018,
          sqFt: 39.63,
          quantity: 1,
          unitPrice: 690,
          total: 27344.7,
        },
      ],
    });
    setViewMode("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOpenEdit = (order) => {
    setEditingOrder(order);
    const rawItems = Array.isArray(order.items) && order.items.length > 0
      ? order.items
      : Array.isArray(order.lineItems) && order.lineItems.length > 0
      ? order.lineItems
      : [];

    const mappedItems = rawItems.length > 0 ? rawItems.map((it) => {
      const w = Number(it.width) || 0;
      const h = Number(it.height) || 0;
      const computedSqFt = w > 0 && h > 0 ? Math.round(((w * h) / 90900) * 100) / 100 : Number(it.sqFt || 0);
      const rate = Number(it.unitPrice || it.rate || 690);
      const qty = Number(it.quantity) || 1;
      const total = computedSqFt > 0 ? Math.round(computedSqFt * rate * qty * 10) / 10 : Number(it.total || rate * qty);

      return {
        productId: it.productId || "",
        productCode: it.productCode || "",
        description: it.description || "Window Unit",
        width: w,
        height: h,
        sqFt: computedSqFt,
        quantity: qty,
        unitPrice: rate,
        total,
      };
    }) : [
      {
        productId: "",
        productCode: "WIN-3TRK-INV",
        description: "3 TRACK WINDOW",
        width: 1500,
        height: 1500,
        sqFt: 24.75,
        quantity: 1,
        unitPrice: 690,
        total: 17077.5,
      },
    ];

    setForm({
      customerId: order.customer?._id || order.customer || "",
      projectName: order.projectName || "",
      orderDate: order.orderDate ? dayjs(order.orderDate).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
      deliveryDate: order.deliveryDate ? dayjs(order.deliveryDate).format("YYYY-MM-DD") : dayjs().add(30, "day").format("YYYY-MM-DD"),
      status: order.status || "confirmed",
      fulfillmentMeasurement: order.fulfillmentMeasurement || "tentative",
      advancePaid: Number(order.advancePaid || 0),
      notes: order.notes || "",
      lineItems: mappedItems,
    });
    setViewMode("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleProductSelect = (idx, prodId) => {
    const prod = products.find((p) => p._id === prodId || p.id === prodId);
    if (!prod) return;

    const updated = [...form.lineItems];
    const item = { ...updated[idx] };
    item.productId = prod._id || prod.id;
    item.productCode = prod.productCode || "";
    item.description = `${prod.name} ${prod.productCode ? `(${prod.productCode})` : ""}`;

    // Auto-populate price
    if (Number(prod.pricePerSqFt) > 0) {
      item.unitPrice = Number(prod.pricePerSqFt);
    } else if (Number(prod.pricePerPiece) > 0) {
      item.unitPrice = Number(prod.pricePerPiece);
    } else if (Number(prod.pricePerMeter) > 0) {
      item.unitPrice = Number(prod.pricePerMeter);
    }

    const w = Number(item.width) || 0;
    const h = Number(item.height) || 0;
    if (w > 0 && h > 0) {
      item.sqFt = Math.round(((w * h) / 90900) * 100) / 100;
      item.total = Math.round(item.sqFt * item.unitPrice * (Number(item.quantity) || 1) * 10) / 10;
    } else {
      item.total = Math.round(item.unitPrice * (Number(item.quantity) || 1));
    }

    updated[idx] = item;
    setForm({ ...form, lineItems: updated });
  };

  const handleLineChange = (idx, field, val) => {
    const updated = [...form.lineItems];
    const item = { ...updated[idx], [field]: val };

    const w = Number(field === "width" ? val : item.width) || 0;
    const h = Number(field === "height" ? val : item.height) || 0;
    const rate = Number(field === "unitPrice" ? val : item.unitPrice) || 0;
    const qty = Number(field === "quantity" ? val : item.quantity) || 1;

    if (w > 0 && h > 0) {
      item.sqFt = Math.round(((w * h) / 90900) * 100) / 100;
      item.total = Math.round(item.sqFt * rate * qty * 10) / 10;
    } else {
      item.total = Math.round(rate * qty);
    }

    updated[idx] = item;
    setForm({ ...form, lineItems: updated });
  };

  const handleAddLine = () => {
    setForm({
      ...form,
      lineItems: [
        ...form.lineItems,
        {
          productId: "",
          productCode: "WIN-3TRK-INV",
          description: "3 TRACK WINDOW",
          width: 1500,
          height: 1500,
          sqFt: 24.75,
          quantity: 1,
          unitPrice: 690,
          total: 17077.5,
        },
      ],
    });
  };

  const handleRemoveLine = (idx) => {
    if (form.lineItems.length === 1) {
      message.warning("Sales order must contain at least one line item.");
      return;
    }
    setForm({
      ...form,
      lineItems: form.lineItems.filter((_, i) => i !== idx),
    });
  };

  const calculateSubtotal = () =>
    form.lineItems.reduce((acc, it) => acc + (Number(it.total) || 0), 0);

  const totalSqFt = form.lineItems.reduce(
    (acc, it) => acc + (Number(it.sqFt) || 0) * (Number(it.quantity) || 1),
    0
  );

  const handleSaveOrder = async () => {
    if (!form.customerId) {
      message.error("Please select a customer.");
      return;
    }
    const subtotal = Math.round(calculateSubtotal());
    const tax = Math.round(subtotal * 0.18);
    const totalAmount = subtotal + tax;
    const advancePaid = Number(form.advancePaid) || 0;
    const balanceDue = Math.max(0, totalAmount - advancePaid);

    try {
      const payload = {
        customer: form.customerId,
        projectName: form.projectName,
        orderDate: form.orderDate,
        deliveryDate: form.deliveryDate,
        status: form.status,
        fulfillmentMeasurement: form.fulfillmentMeasurement || "tentative",
        advancePaid,
        balanceDue,
        notes: form.notes,
        items: form.lineItems.map((it) => ({
          productId: it.productId,
          productCode: it.productCode,
          description: it.description,
          width: Number(it.width) || 0,
          height: Number(it.height) || 0,
          sqFt: Number(it.sqFt) || 0,
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
          total: Number(it.total) || 0,
        })),
        subtotal,
        taxAmount: tax,
        totalAmount,
      };

      if (editingOrder) {
        await salesOrderAPI.update(editingOrder._id, payload);
        message.success("Sales order updated successfully.");
      } else {
        await salesOrderAPI.create(payload);
        message.success("Sales order confirmed successfully.");
      }
      setViewMode("list");
      fetchOrders();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to save sales order.");
    }
  };

  const handleDeleteOrder = async () => {
    if (!editingOrder) return;
    if (!window.confirm("Are you sure you want to delete this sales order?")) return;
    try {
      await salesOrderAPI.delete(editingOrder._id);
      message.success("Sales order deleted.");
      setViewMode("list");
      fetchOrders();
    } catch (err) {
      message.error("Failed to delete sales order.");
    }
  };

  const filteredOrders = orders.filter((o) => {
    const custName = o.customerSnapshot?.companyName || o.customerSnapshot?.name || o.customer?.companyName || "";
    const matches =
      custName.toLowerCase().includes(search.toLowerCase()) ||
      (o.orderNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.projectName || "").toLowerCase().includes(search.toLowerCase());
    if (!matches) return false;
    if (statusFilter === "All") return true;

    // Filter by fulfillment measurement if selected
    const sFilter = statusFilter.toLowerCase();
    if (sFilter === "final" || sFilter === "tentative") {
      const measurement = (o.fulfillmentMeasurement || "tentative").toLowerCase();
      return measurement === sFilter;
    }

    return (o.status || "").toLowerCase() === sFilter;
  });

  const totalPipeline = orders.reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0);
  const activeProductionCount = orders.filter((o) => o.status === "in-production" || o.status === "confirmed").length;

  // Extract unique categories for dropdown filter
  const distinctCategories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

  // If in "form" mode, render the full page dedicated editor (NO OVERLAY MODAL)
  if (viewMode === "form") {
    const subtotal = Math.round(calculateSubtotal());
    const tax = Math.round(subtotal * 0.18);
    const totalAmount = subtotal + tax;
    const advancePaid = Number(form.advancePaid) || 0;
    const balanceDue = Math.max(0, totalAmount - advancePaid);

    return (
      <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 40 }}>
        {/* Navigation Breadcrumb & Back Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="crumb" style={{ marginBottom: 0 }}>
            ARCIOX <span style={{ margin: "0 6px" }}>/</span> SALES ORDERS <span style={{ margin: "0 6px" }}>/</span>{" "}
            <b>{editingOrder ? `EDIT ${editingOrder.orderNumber}` : "NEW ORDER"}</b>
          </div>
          <button
            className="btn"
            style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => setViewMode("list")}
          >
            ← Back to Orders Register
          </button>
        </div>

        {/* Page Head */}
        <div className="pagehead" style={{ marginBottom: 20 }}>
          <div>
            <h1>{editingOrder ? `Sales Order: ${editingOrder.orderNumber}` : "Create Confirmed Sales Order"}</h1>
            <p>
              Fabrication order booking with Prominance uPVC profiles, hardware accessories &amp; automatic Sq. Ft measurement engine.
            </p>
          </div>
          <div className="actions">
            {editingOrder && (
              <button className="btn" style={{ color: "var(--red)", borderColor: "#fca5a5" }} onClick={handleDeleteOrder}>
                🗑 Delete Order
              </button>
            )}
            <button className="btn" onClick={() => setViewMode("list")}>
              Cancel
            </button>
            <button className="btn primary" onClick={handleSaveOrder} style={{ background: "#103567", borderColor: "#103567" }}>
              💾 {editingOrder ? "Save Changes" : "Confirm Sales Order"}
            </button>
          </div>
        </div>

        {/* Section 1: Customer & Schedule Details Card */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
            <div>
              <h3 style={{ margin: 0, color: "#103567" }}>1. Client &amp; Order Scheduling</h3>
              <small className="muted">Primary order contact, delivery milestones and fulfillment status.</small>
            </div>
            <div>{orderStatusPill(form.status)}</div>
          </div>
          <div className="cardbody">
            <div className="formgrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div className="field">
                <label>Customer *</label>
                <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                  <option value="">Select Customer...</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.companyName || c.name} {c.phone ? `(${c.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Project / Site Name</label>
                <input
                  value={form.projectName}
                  onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                  placeholder="e.g. Abhishek Jain Villa, Shahdol"
                />
              </div>
              <div className="field">
                <label>Order Booking Date</label>
                <input type="date" value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} />
              </div>
              <div className="field">
                <label>Target Delivery Date</label>
                <input type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
              </div>
              <div className="field">
                <label>Fulfillment Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="confirmed">Confirmed</option>
                  <option value="in-production">In Production</option>
                  <option value="ready">Ready for Dispatch</option>
                  <option value="dispatched">Dispatched</option>
                  <option value="delivered">Delivered / Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="field">
                <label>Fulfillment Measurement</label>
                <select
                  value={form.fulfillmentMeasurement || "tentative"}
                  onChange={(e) => setForm({ ...form, fulfillmentMeasurement: e.target.value })}
                >
                  <option value="tentative">Tentative</option>
                  <option value="final">Final</option>
                </select>
              </div>
              <div className="field">
                <label>Advance Payment Received (₹)</label>
                <input
                  type="number"
                  value={form.advancePaid}
                  onChange={(e) => setForm({ ...form, advancePaid: Number(e.target.value) || 0 })}
                  placeholder="₹ 0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Line Items & Measurement Grid Card */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
            <div>
              <h3 style={{ margin: 0, color: "#103567" }}>2. Window &amp; Hardware Line Items</h3>
              <small className="muted">
                Select from 12 Prominance categories (Windows, Doors, Profiles, Glazing Beads, Aluminium &amp; 34 Plastic Accessories).
              </small>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <select
                className="btn"
                style={{ fontSize: 12, padding: "5px 10px" }}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="All">All 12 Categories</option>
                {distinctCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button className="btn primary" style={{ fontSize: 12 }} onClick={handleAddLine}>
                ＋ Add Line Item
              </button>
            </div>
          </div>

          <div className="tablewrap" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ width: 40, textAlign: "center" }}>#</th>
                  <th style={{ minWidth: 260 }}>Select Item from Prominance Catalogue</th>
                  <th style={{ minWidth: 200 }}>Description / Custom Label</th>
                  <th style={{ width: 90 }}>Width (mm)</th>
                  <th style={{ width: 90 }}>Height (mm)</th>
                  <th style={{ width: 85 }}>Sq. Ft</th>
                  <th style={{ width: 70 }}>Qty</th>
                  <th style={{ width: 100 }}>Rate (₹)</th>
                  <th style={{ width: 110, textAlign: "right" }}>Total (₹)</th>
                  <th style={{ width: 40, textAlign: "center" }}>✕</th>
                </tr>
              </thead>
              <tbody>
                {form.lineItems.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: "center", fontWeight: 600 }}>{idx + 1}</td>
                    <td>
                      <select
                        style={{ width: "100%", fontSize: 12, padding: "6px 8px" }}
                        value={item.productId || ""}
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                      >
                        <option value="">-- Choose from Catalogue --</option>
                        {distinctCategories
                          .filter((cat) => categoryFilter === "All" || cat === categoryFilter)
                          .map((cat) => (
                            <optgroup key={cat} label={`📂 ${cat}`}>
                              {products
                                .filter((p) => p.category === cat)
                                .map((p) => {
                                  const priceLabel =
                                    p.pricePerSqFt > 0
                                      ? `₹${p.pricePerSqFt}/sqft`
                                      : p.pricePerPiece > 0
                                      ? `₹${p.pricePerPiece}/pc`
                                      : p.pricePerMeter > 0
                                      ? `₹${p.pricePerMeter}/m`
                                      : "";
                                  return (
                                    <option key={p._id || p.id} value={p._id || p.id}>
                                      {p.name} {p.productCode ? `(${p.productCode})` : ""} {priceLabel ? `- ${priceLabel}` : ""}
                                    </option>
                                  );
                                })}
                            </optgroup>
                          ))}
                      </select>
                    </td>
                    <td>
                      <input
                        style={{ width: "100%", fontSize: 12, padding: "5px 8px" }}
                        placeholder="Item name / Custom specs"
                        value={item.description}
                        onChange={(e) => handleLineChange(idx, "description", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ width: "100%", fontSize: 12, padding: "5px 6px" }}
                        placeholder="W (mm)"
                        value={item.width || ""}
                        onChange={(e) => handleLineChange(idx, "width", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ width: "100%", fontSize: 12, padding: "5px 6px" }}
                        placeholder="H (mm)"
                        value={item.height || ""}
                        onChange={(e) => handleLineChange(idx, "height", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        style={{ width: "100%", fontSize: 12, padding: "5px 6px", background: "#f8fafc", fontWeight: 600 }}
                        value={item.sqFt || ""}
                        onChange={(e) => handleLineChange(idx, "sqFt", e.target.value)}
                        placeholder="Sq. Ft"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        style={{ width: "100%", fontSize: 12, padding: "5px 6px" }}
                        value={item.quantity || 1}
                        onChange={(e) => handleLineChange(idx, "quantity", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ width: "100%", fontSize: 12, padding: "5px 6px" }}
                        value={item.unitPrice || ""}
                        onChange={(e) => handleLineChange(idx, "unitPrice", e.target.value)}
                        placeholder="₹"
                      />
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#103567", fontSize: 13 }}>
                      ₹{Number(item.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ color: "var(--red)", padding: "2px 6px", fontSize: 11 }}
                        onClick={() => handleRemoveLine(idx)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "2px solid #cbd5e1" }}>
                  <td colSpan={5} style={{ textAlign: "right", padding: "10px" }}>
                    TOTAL FABRICATION AREA:
                  </td>
                  <td style={{ padding: "10px", color: "#103567" }}>{totalSqFt.toFixed(2)} Sq. Ft</td>
                  <td style={{ padding: "10px", textAlign: "right" }} colSpan={2}>
                    SUBTOTAL:
                  </td>
                  <td style={{ textAlign: "right", padding: "10px", color: "#103567", fontSize: 14 }}>
                    ₹{subtotal.toLocaleString("en-IN")}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Section 3: Commercial Notes & Financial Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
          <div className="card">
            <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
              <h3 style={{ margin: 0, color: "#103567" }}>3. Production &amp; Delivery Instructions</h3>
            </div>
            <div className="cardbody">
              <div className="field">
                <label>Commercial Notes, Site Handling &amp; Transporter Terms</label>
                <textarea
                  rows={6}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="e.g. Glass thickness: 10mm clear toughened glass. Hardware: SS 304 friction stays and touch locks. FOR site delivery."
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
              <h3 style={{ margin: 0, color: "#103567" }}>4. Financial Breakdown</h3>
            </div>
            <div className="cardbody">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span className="muted">Fabrication Subtotal:</span>
                <b>₹{subtotal.toLocaleString("en-IN")}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span className="muted">GST (18%):</span>
                <b>₹{tax.toLocaleString("en-IN")}</b>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 10,
                  fontSize: 16,
                  paddingTop: 8,
                  borderTop: "1px solid var(--line)",
                }}
              >
                <span>Grand Total:</span>
                <strong style={{ color: "#103567" }}>₹{totalAmount.toLocaleString("en-IN")}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, color: "var(--green)" }}>
                <span>Advance Paid:</span>
                <b>₹{advancePaid.toLocaleString("en-IN")}</b>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 18,
                  paddingTop: 10,
                  borderTop: "2px solid #cbd5e1",
                  marginTop: 6,
                }}
              >
                <span>Balance Due:</span>
                <strong style={{ color: balanceDue > 0 ? "var(--red)" : "var(--green)" }}>
                  ₹{balanceDue.toLocaleString("en-IN")}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
          <button className="btn" onClick={() => setViewMode("list")}>
            ← Back to Orders Register
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" onClick={() => setViewMode("list")}>
              Cancel
            </button>
            <button className="btn primary" onClick={handleSaveOrder} style={{ background: "#103567", borderColor: "#103567" }}>
              💾 {editingOrder ? "Save Changes" : "Confirm Sales Order"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // List View (Default Register Table)
  return (
    <>
      <div className="crumb">
        ARCIOX <span style={{ margin: "0 6px" }}>/</span> SALES ORDERS
      </div>
      <div className="pagehead">
        <div>
          <h1>Sales Orders</h1>
          <p>Fabrication work orders, glass specifications, fulfillment milestones &amp; customer billing.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => message.info("Exporting sales orders...")}>
            ⇩ Export
          </button>
          <button className="btn primary" onClick={handleOpenCreate}>
            ＋ Create sales order
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid stats">
        <div className="card stat">
          <div className="statrow">
            <span>Orders Pipeline</span>
            <span className="staticon">▧</span>
          </div>
          <strong>₹{totalPipeline.toLocaleString("en-IN")}</strong>
          <span className="trend">{orders.length} confirmed orders</span>
        </div>
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
            <span>Delivered / Completed</span>
            <span className="staticon">✓</span>
          </div>
          <strong style={{ color: "var(--green)" }}>{orders.filter((o) => o.status === "delivered").length}</strong>
          <span className="trend">Successfully handed over</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Catalogue Profiles Loaded</span>
            <span className="staticon">🪟</span>
          </div>
          <strong style={{ color: "var(--blue)" }}>{products.length}</strong>
          <span className="trend">Across 12 Prominance series</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card">
        <div className="cardhead">
          <div>
            <h2>Orders Register</h2>
            <small className="muted">Live fabrication queues, dispatch dates and fulfillment tracking.</small>
          </div>
          <div className="actions">
            <input
              type="text"
              placeholder="Search order #, client, project…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 250 }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="btn"
              style={{ padding: "6px 10px" }}
            >
              <option value="All">All statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="in-production">In Production</option>
              <option value="ready">Ready</option>
              <option value="dispatched">Dispatched</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="final">Final</option>
              <option value="tentative">Tentative</option>
            </select>
          </div>
        </div>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Client</th>
                <th>Project / Site</th>
                <th>Order Date</th>
                <th>Target Delivery</th>
                <th>Total Value</th>
                <th>Advance / Balance</th>
                <th>Status</th>
                <th>Fulfillment Measurement</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((r, i) => (
                  <tr key={r._id || i}>
                    <td>
                      <b>{r.orderNumber || `SO-2026-${String(i + 1).padStart(4, "0")}`}</b>
                    </td>
                    <td>
                      <div className="customer">
                        <div className="miniavatar">
                          {(r.customerSnapshot?.companyName || r.customer?.companyName || "C").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <b>{r.customerSnapshot?.companyName || r.customer?.companyName || "Client"}</b>
                          <small>{r.customerSnapshot?.contactPerson || r.customer?.phone || r.customer?.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>{r.projectName || "General Installation"}</td>
                    <td>{r.orderDate ? dayjs(r.orderDate).format("DD MMM YYYY") : "Today"}</td>
                    <td>{r.deliveryDate ? dayjs(r.deliveryDate).format("DD MMM YYYY") : "30 Days"}</td>
                    <td>
                      <b>₹{Number(r.totalAmount || 0).toLocaleString("en-IN")}</b>
                    </td>
                    <td>
                      <small style={{ color: "var(--green)", display: "block" }}>
                        Adv: ₹{Number(r.advancePaid || 0).toLocaleString("en-IN")}
                      </small>
                      <small style={{ color: Number(r.balanceDue) > 0 ? "var(--red)" : "#64748b" }}>
                        Due: ₹{Number(r.balanceDue || Math.max(0, (r.totalAmount || 0) - (r.advancePaid || 0))).toLocaleString("en-IN")}
                      </small>
                    </td>
                    <td>{orderStatusPill(r.status)}</td>
                    <td>{fulfillmentMeasurementPill(r.fulfillmentMeasurement)}</td>
                    <td>
                      <button
                        className="btn"
                        style={{ padding: "6px 12px", fontWeight: 600, color: "var(--navy)" }}
                        onClick={() => handleOpenEdit(r)}
                      >
                        View / Edit ↗
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10">
                    <div className="emptyhint">
                      <b>No sales orders found</b>
                      {loading ? "Loading orders..." : "Click '+ Create sales order' to start a fabrication order."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 16px", color: "#8390a2", fontSize: 11, borderTop: "1px solid var(--line)" }}>
          Showing {filteredOrders.length} sales orders · ARCIOX Order Fulfillment Pipeline
        </div>
      </div>
    </>
  );
}
