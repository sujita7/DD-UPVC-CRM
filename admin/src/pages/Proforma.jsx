import React, { useState, useEffect } from "react";
import { App } from "antd";
import dayjs from "dayjs";
import { invoiceAPI, customerAPI, productAPI } from "../services/api";
import ProformaInvoiceTemplate from "../components/ProformaInvoiceTemplate";

function proformaStatusPill(s) {
  const x = (s || "").toLowerCase();
  let c = /paid|converted|approved/.test(x)
    ? "green"
    : /sent/.test(x)
    ? "blue"
    : /cancelled|rejected/.test(x)
    ? "red"
    : "amber";
  return <span className={`pill ${c}`}>{s ? s.toUpperCase() : "DRAFT"}</span>;
}

export default function Proforma() {
  const { message } = App.useApp();
  const [proformas, setProformas] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Preview Template Modal State
  const [activeTemplateProforma, setActiveTemplateProforma] = useState(null);

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProforma, setEditingProforma] = useState(null);
  const [form, setForm] = useState({
    customerId: "",
    invoiceNumber: "",
    invoiceDate: dayjs().format("YYYY-MM-DD"),
    dueDate: dayjs().add(15, "day").format("YYYY-MM-DD"),
    paymentTerms: "50% Advance, 30% After Dispatch, 20% After Installation",
    status: "draft",
    notes: "Installation work on FOR basis. Project duration 25 to 35 working days after advance payment.",
    specifications: {
      series: "INVENTA",
      glass: "10 MM CLEAR TUFF GLASS",
      sash: "79MM SLIDING SASH",
      mesh: "SS MESH 304G NATURAL",
    },
    perSqFtRate: 690,
    lineItems: [
      {
        productId: "",
        productCode: "WIN-3TRK-INV",
        description: "3 TRACK WINDOW",
        width: 1785,
        height: 2018,
        sqFt: 39.63,
        rate: 690,
        quantity: 1,
        total: 27344.7,
      },
    ],
  });

  const fetchProformas = async () => {
    setLoading(true);
    try {
      const res = await invoiceAPI.list({ invoiceType: "proforma", limit: 100 });
      setProformas(res.data?.invoices || []);
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
      const res = await productAPI.list({ limit: 200 });
      setProducts(res.data?.products || []);
    } catch (err) {
      console.error("Failed to load products catalogue", err);
    }
  };

  useEffect(() => {
    fetchProformas();
    fetchCustomers();
    fetchProducts();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingProforma(null);
    setForm({
      customerId: customers[0]?._id || "",
      invoiceNumber: "",
      invoiceDate: dayjs().format("YYYY-MM-DD"),
      dueDate: dayjs().add(15, "day").format("YYYY-MM-DD"),
      paymentTerms: "50% Advance, 30% After Dispatch, 20% After Installation",
      status: "draft",
      notes: "Installation work on FOR basis. Project duration 25 to 35 working days after advance payment.",
      specifications: {
        series: "INVENTA",
        glass: "10 MM CLEAR TUFF GLASS",
        sash: "79MM SLIDING SASH",
        mesh: "SS MESH 304G NATURAL",
      },
      perSqFtRate: 690,
      lineItems: [
        {
          productId: "",
          productCode: "WIN-3TRK-INV",
          description: "3 TRACK WINDOW",
          width: 1785,
          height: 2018,
          sqFt: 39.63,
          rate: 690,
          quantity: 1,
          total: 27344.7,
        },
      ],
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (pi) => {
    setEditingProforma(pi);
    const rawItems = Array.isArray(pi.items) && pi.items.length > 0
      ? pi.items
      : Array.isArray(pi.lineItems) && pi.lineItems.length > 0
      ? pi.lineItems
      : [];

    const mappedItems = rawItems.length > 0 ? rawItems.map((it) => {
      const w = Number(it.width) || 0;
      const h = Number(it.height) || 0;
      const computedSqFt = w > 0 && h > 0 ? Math.round(((w * h) / 90900) * 100) / 100 : Number(it.sqFt || it.area || 0);
      const rate = Number(it.rate || it.unitPrice || pi.perSqFtRate || 690);
      const qty = Number(it.quantity) || 1;
      const total = computedSqFt > 0 ? Math.round(computedSqFt * rate * qty * 10) / 10 : Number(it.total || rate * qty);

      return {
        productId: it.productId || "",
        productCode: it.productCode || "",
        description: it.description || it.name || "Window Unit",
        width: w,
        height: h,
        sqFt: computedSqFt,
        rate,
        quantity: qty,
        total,
      };
    }) : [
      {
        productId: "",
        productCode: "WIN-3TRK-INV",
        description: "3 TRACK WINDOW",
        width: 1785,
        height: 2018,
        sqFt: 39.63,
        rate: 690,
        quantity: 1,
        total: 27344.7,
      },
    ];

    const specs = pi.specifications || {};

    setForm({
      customerId: pi.customer?._id || pi.customer || "",
      invoiceNumber: pi.invoiceNumber || "",
      invoiceDate: pi.invoiceDate ? dayjs(pi.invoiceDate).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
      dueDate: pi.dueDate ? dayjs(pi.dueDate).format("YYYY-MM-DD") : dayjs().add(15, "day").format("YYYY-MM-DD"),
      paymentTerms: pi.paymentTerms || "50% Advance, 30% After Dispatch, 20% After Installation",
      status: pi.status || "draft",
      notes: pi.notes || "",
      specifications: {
        series: specs.series || "INVENTA",
        glass: specs.glass || "10 MM CLEAR TUFF GLASS",
        sash: specs.sash || "79MM SLIDING SASH",
        mesh: specs.mesh || "SS MESH 304G NATURAL",
      },
      perSqFtRate: Number(pi.perSqFtRate) || 690,
      lineItems: mappedItems,
    });
    setIsModalOpen(true);
  };

  const loadAbhishekJainSample = () => {
    const sampleItems = [
      { productId: "", productCode: "WIN-3TRK-INV", description: "3 TRACK WINDOW", width: 1785, height: 2018, sqFt: 39.63, rate: 690, quantity: 1, total: 27344.7 },
      { productId: "", productCode: "WIN-3TRK-INV", description: "3 TRACK WINDOW", width: 1778, height: 1988, sqFt: 38.88, rate: 690, quantity: 1, total: 26827.2 },
      { productId: "", productCode: "WIN-OPEN-INV", description: "OPENABLE WINDOW", width: 824, height: 859, sqFt: 7.79, rate: 690, quantity: 1, total: 5375.1 },
      { productId: "", productCode: "WIN-3TRK-INV", description: "3 TRACK WINDOW", width: 2161, height: 2055, sqFt: 48.85, rate: 690, quantity: 1, total: 33706.5 },
      { productId: "", productCode: "WIN-OPEN-INV", description: "OPENABLE WINDOW", width: 938, height: 1578, sqFt: 16.28, rate: 690, quantity: 1, total: 11233.2 },
      { productId: "", productCode: "WIN-3TRK-INV", description: "3 TRACK WINDOW", width: 1908, height: 1583, sqFt: 33.23, rate: 690, quantity: 1, total: 22928.7 },
      { productId: "", productCode: "WIN-3TRK-INV", description: "3 TRACK WINDOW", width: 1912, height: 1581, sqFt: 33.25, rate: 690, quantity: 1, total: 22942.5 },
      { productId: "", productCode: "WIN-OPEN-INV", description: "OPENABLE WINDOW", width: 528, height: 2393, sqFt: 13.90, rate: 690, quantity: 1, total: 9591.0 },
      { productId: "", productCode: "WIN-OPEN-INV", description: "OPENABLE WINDOW", width: 1483, height: 1066, sqFt: 17.39, rate: 690, quantity: 1, total: 11999.1 },
    ];

    setForm((prev) => ({
      ...prev,
      specifications: {
        series: "INVENTA",
        glass: "10 MM CLEAR TUFF GLASS",
        sash: "79MM SLIDING SASH",
        mesh: "SS MESH 304G NATURAL",
      },
      perSqFtRate: 690,
      lineItems: sampleItems,
    }));
    message.success("Loaded DD UPVC Windows / Abhishek Jain specifications & 9 sample window items!");
  };

  const handleProductSelect = (idx, prodId) => {
    const prod = products.find((p) => p._id === prodId || p.id === prodId);
    if (!prod) return;

    const updated = [...form.lineItems];
    const item = { ...updated[idx] };
    item.productId = prod._id || prod.id;
    item.productCode = prod.productCode || "";
    item.description = prod.name;

    // Default rate from product or global rate
    if (Number(prod.pricePerSqFt) > 0) {
      item.rate = Number(prod.pricePerSqFt);
    } else if (Number(prod.pricePerMeter) > 0) {
      item.rate = Number(prod.pricePerMeter);
    } else {
      item.rate = form.perSqFtRate || 690;
    }

    // Recalculate sqFt and total
    const w = Number(item.width) || 0;
    const h = Number(item.height) || 0;
    if (w > 0 && h > 0) {
      item.sqFt = Math.round(((w * h) / 90900) * 100) / 100;
      item.total = Math.round(item.sqFt * item.rate * (Number(item.quantity) || 1) * 10) / 10;
    } else {
      item.total = Math.round(item.rate * (Number(item.quantity) || 1));
    }

    updated[idx] = item;
    setForm({ ...form, lineItems: updated });
  };

  const handleLineChange = (idx, field, val) => {
    const updated = [...form.lineItems];
    const item = { ...updated[idx], [field]: val };

    const w = Number(field === "width" ? val : item.width) || 0;
    const h = Number(field === "height" ? val : item.height) || 0;
    const rate = Number(field === "rate" ? val : item.rate) || form.perSqFtRate || 690;
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
          sqFt: Math.round(((1500 * 1500) / 90900) * 100) / 100,
          rate: form.perSqFtRate || 690,
          quantity: 1,
          total: Math.round(((1500 * 1500) / 90900) * (form.perSqFtRate || 690) * 10) / 10,
        },
      ],
    });
  };

  const handleRemoveLine = (idx) => {
    if (form.lineItems.length === 1) {
      message.warning("Proforma invoice must have at least one line item.");
      return;
    }
    setForm({
      ...form,
      lineItems: form.lineItems.filter((_, i) => i !== idx),
    });
  };

  // Compute overall summary totals
  const totalSqFt = form.lineItems.reduce((acc, it) => acc + (Number(it.sqFt) || 0) * (Number(it.quantity) || 1), 0);
  const totalAmount = Math.round(form.lineItems.reduce((acc, it) => acc + (Number(it.total) || 0), 0));

  const handleSaveProforma = async () => {
    if (!form.customerId) {
      message.error("Please select a customer.");
      return;
    }

    try {
      const payload = {
        invoiceType: "proforma",
        customer: form.customerId,
        invoiceNumber: form.invoiceNumber || undefined,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate,
        paymentTerms: form.paymentTerms,
        status: form.status,
        notes: form.notes,
        specifications: form.specifications,
        perSqFtRate: Number(form.perSqFtRate) || 690,
        items: form.lineItems.map((it) => ({
          productId: it.productId,
          productCode: it.productCode,
          description: it.description,
          width: Number(it.width) || 0,
          height: Number(it.height) || 0,
          sqFt: Number(it.sqFt) || 0,
          rate: Number(it.rate),
          unitPrice: Number(it.rate),
          quantity: Number(it.quantity) || 1,
          total: Number(it.total),
        })),
        subtotal: totalAmount,
        totalAmount,
        grandTotal: totalAmount,
      };

      if (editingProforma) {
        await invoiceAPI.update(editingProforma._id, payload);
        message.success("Proforma invoice updated successfully.");
      } else {
        await invoiceAPI.create(payload);
        message.success("Proforma invoice created successfully.");
      }
      setIsModalOpen(false);
      fetchProformas();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to save proforma invoice.");
    }
  };

  const handleConvertToTaxInvoice = async (pi) => {
    if (!window.confirm(`Convert Proforma ${pi.invoiceNumber} to official Tax Invoice?`)) return;
    try {
      await invoiceAPI.update(pi._id, {
        invoiceType: "tax-invoice",
        status: "unpaid",
      });
      message.success(`Converted ${pi.invoiceNumber} to Tax Invoice!`);
      fetchProformas();
    } catch (err) {
      message.error("Conversion failed.");
    }
  };

  const handleDeleteProforma = async () => {
    if (!editingProforma) return;
    if (!window.confirm("Are you sure you want to delete this proforma invoice?")) return;
    try {
      await invoiceAPI.delete(editingProforma._id);
      message.success("Proforma invoice deleted.");
      setIsModalOpen(false);
      fetchProformas();
    } catch (err) {
      message.error("Failed to delete proforma invoice.");
    }
  };

  const filteredProformas = proformas.filter((p) => {
    const custName = p.customerSnapshot?.companyName || p.customerSnapshot?.name || p.customer?.companyName || "";
    const matches =
      custName.toLowerCase().includes(search.toLowerCase()) ||
      (p.invoiceNumber || "").toLowerCase().includes(search.toLowerCase());
    if (!matches) return false;
    if (statusFilter === "All") return true;
    return (p.status || "").toLowerCase() === statusFilter.toLowerCase();
  });

  const totalProformaPipeline = proformas.reduce((acc, p) => acc + (Number(p.totalAmount || p.grandTotal) || 0), 0);
  const paidCount = proformas.filter((p) => p.status === "paid" || p.status === "converted").length;

  return (
    <>
      <div className="crumb">
        ARCIOX <span style={{ margin: "0 6px" }}>/</span> PROFORMA INVOICES
      </div>
      <div className="pagehead">
        <div>
          <h1>Proforma Invoices</h1>
          <p>DD UPVC Windows standard fabrication quotations, measurement calculations &amp; client proformas.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => message.info("Exporting proforma register to CSV...")}>
            ⇩ Export
          </button>
          <button className="btn primary" onClick={handleOpenCreateModal}>
            ＋ Create proforma
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid stats">
        <div className="card stat">
          <div className="statrow">
            <span>Total Proforma Pipeline</span>
            <span className="staticon">▧</span>
          </div>
          <strong>₹{totalProformaPipeline.toLocaleString("en-IN")}</strong>
          <span className="trend">{proformas.length} active documents</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Approved / Paid</span>
            <span className="staticon">✓</span>
          </div>
          <strong style={{ color: "var(--green)" }}>{paidCount}</strong>
          <span className="trend">Ready to convert to Tax Invoice</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Pending Client Advance</span>
            <span className="staticon">◷</span>
          </div>
          <strong>{proformas.length - paidCount}</strong>
          <span className="trend">Awaiting 50% commitment advance</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Catalogue Profiles Loaded</span>
            <span className="staticon">🪟</span>
          </div>
          <strong style={{ color: "var(--blue)" }}>{products.length}</strong>
          <span className="trend">Prominance uPVC &amp; Hardware items</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card">
        <div className="cardhead">
          <div>
            <h2>Proforma Register</h2>
            <small className="muted">Live billing estimates, validity deadlines and conversion tracking.</small>
          </div>
          <div className="actions">
            <input
              type="text"
              placeholder="Search proforma #, client…"
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
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="converted">Converted</option>
            </select>
          </div>
        </div>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Proforma #</th>
                <th>Client Details</th>
                <th>Issue Date</th>
                <th>Valid Until</th>
                <th>Window Series</th>
                <th>Total Value</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredProformas.length > 0 ? (
                filteredProformas.map((r, i) => {
                  const specs = r.specifications || {};
                  return (
                    <tr key={r._id || i}>
                      <td>
                        <b>{r.invoiceNumber || `PI-2026-${String(i + 1).padStart(4, "0")}`}</b>
                      </td>
                      <td>
                        <div className="customer">
                          <div className="miniavatar">
                            {(r.customerSnapshot?.companyName || r.customerSnapshot?.name || r.customer?.companyName || "C").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <b>{r.customerSnapshot?.companyName || r.customerSnapshot?.name || r.customer?.companyName || "Client"}</b>
                            <small>{r.customerSnapshot?.contactPerson || r.customerSnapshot?.phone || r.customerSnapshot?.email || r.customer?.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>{r.invoiceDate ? dayjs(r.invoiceDate).format("DD MMM YYYY") : "Today"}</td>
                      <td>{r.dueDate ? dayjs(r.dueDate).format("DD MMM YYYY") : "15 Days"}</td>
                      <td>
                        <span className="pill blue" style={{ fontSize: 11 }}>
                          {specs.series || "INVENTA"}
                        </span>
                      </td>
                      <td>
                        <b>₹{Number(r.totalAmount || r.grandTotal || 0).toLocaleString("en-IN")}</b>
                      </td>
                      <td>{proformaStatusPill(r.status)}</td>
                      <td>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            className="btn primary"
                            style={{ padding: "5px 10px", fontSize: 12, background: "#103567", borderColor: "#103567" }}
                            onClick={() => setActiveTemplateProforma(r)}
                            title="Open exact DD UPVC Printable & Downloadable Template"
                          >
                            👁 View Template
                          </button>
                          <button
                            className="btn"
                            style={{ padding: "5px 8px", fontSize: 12 }}
                            onClick={() => handleOpenEditModal(r)}
                            title="Edit Measurements & Line Items"
                          >
                            ✏ Edit
                          </button>
                          <button
                            className="btn"
                            style={{ padding: "5px 8px", fontSize: 11, color: "var(--blue)" }}
                            onClick={() => handleConvertToTaxInvoice(r)}
                            title="Convert to final Tax Invoice"
                          >
                            ➔ Tax Inv
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8">
                    <div className="emptyhint">
                      <b>No proforma invoices found</b>
                      {loading ? "Loading proforma invoices..." : "Click '+ Create proforma' to issue a new preliminary invoice."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 16px", color: "#8390a2", fontSize: 11, borderTop: "1px solid var(--line)" }}>
          Showing {filteredProformas.length} proforma invoices · DD UPVC Windows Fabrication Engine
        </div>
      </div>

      {/* Abhishek Jain Proforma Invoice Template Preview & Print/Email Modal */}
      {activeTemplateProforma && (
        <ProformaInvoiceTemplate
          proforma={activeTemplateProforma}
          onClose={() => setActiveTemplateProforma(null)}
          onRefresh={fetchProformas}
        />
      )}

      {/* Create / Edit Proforma Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 960, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="cardhead" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
              <div>
                <h2>{editingProforma ? `Edit Proforma Invoice (${editingProforma.invoiceNumber || ""})` : "Create DD UPVC Proforma Invoice"}</h2>
                <small className="muted">Automatic Sq. Ft calculation from mm dimensions with Prominance profile pricing.</small>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  className="btn"
                  style={{ background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe", fontSize: 12, fontWeight: 600 }}
                  onClick={loadAbhishekJainSample}
                  title="Auto-fill with Abhishek Jain sample items and 249.20 Sq. Ft specifications"
                >
                  ⚡ Load Abhishek Jain Sample
                </button>
                <button className="btn" onClick={() => setIsModalOpen(false)}>
                  ✕
                </button>
              </div>
            </div>

            <div className="cardbody">
              {/* Customer and Dates Grid */}
              <div className="formgrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                <div className="field">
                  <label>Customer *</label>
                  <select
                    value={form.customerId}
                    onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                  >
                    <option value="">Select Customer...</option>
                    {customers.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.companyName || c.name} {c.phone ? `(${c.phone})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Invoice Date</label>
                  <input
                    type="date"
                    value={form.invoiceDate}
                    onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Valid Until / Due Date</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Per Sq. Ft Rate (₹)</label>
                  <input
                    type="number"
                    value={form.perSqFtRate}
                    onChange={(e) => {
                      const r = Number(e.target.value) || 0;
                      setForm({
                        ...form,
                        perSqFtRate: r,
                        lineItems: form.lineItems.map((it) => ({
                          ...it,
                          rate: r,
                          total: it.sqFt > 0 ? Math.round(it.sqFt * r * (Number(it.quantity) || 1) * 10) / 10 : r * (Number(it.quantity) || 1),
                        })),
                      });
                    }}
                    placeholder="e.g. 690"
                  />
                </div>
              </div>

              {/* Window Specifications Banner */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  padding: "12px 14px",
                  marginTop: 14,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 12, color: "#103567", textTransform: "uppercase", marginBottom: 8 }}>
                  🪟 Specification Details (Banner on PDF Proforma)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>WINDOW SERIES</label>
                    <input
                      style={{ fontSize: 12, padding: "5px 8px" }}
                      value={form.specifications.series}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          specifications: { ...form.specifications, series: e.target.value },
                        })
                      }
                      placeholder="e.g. INVENTA"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>GLASS SPECIFICATION</label>
                    <input
                      style={{ fontSize: 12, padding: "5px 8px" }}
                      value={form.specifications.glass}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          specifications: { ...form.specifications, glass: e.target.value },
                        })
                      }
                      placeholder="e.g. 10 MM CLEAR TUFF GLASS"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>SASH SPECIFICATION</label>
                    <input
                      style={{ fontSize: 12, padding: "5px 8px" }}
                      value={form.specifications.sash}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          specifications: { ...form.specifications, sash: e.target.value },
                        })
                      }
                      placeholder="e.g. 79MM SLIDING SASH"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>MESH SPECIFICATION</label>
                    <input
                      style={{ fontSize: 12, padding: "5px 8px" }}
                      value={form.specifications.mesh}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          specifications: { ...form.specifications, mesh: e.target.value },
                        })
                      }
                      placeholder="e.g. SS MESH 304G NATURAL"
                    />
                  </div>
                </div>
              </div>

              {/* Line Items Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "20px 0 10px" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 13, color: "#103567", textTransform: "uppercase" }}>
                    Window &amp; Door Measurement Grid
                  </h4>
                  <small style={{ color: "#64748b", fontSize: 11 }}>
                    Area formula: (Width mm × Height mm) ÷ 90,900 = Sq. Ft
                  </small>
                </div>
                <button className="btn" style={{ padding: "5px 10px", fontSize: 12 }} onClick={handleAddLine}>
                  ＋ Add Window Item
                </button>
              </div>

              {/* Line Items Grid Table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", textAlign: "left", borderBottom: "2px solid #cbd5e1" }}>
                      <th style={{ padding: "6px 8px", width: 40 }}>S No</th>
                      <th style={{ padding: "6px 8px", minWidth: 220 }}>Window Design / Product</th>
                      <th style={{ padding: "6px 8px", width: 100 }}>Width (mm)</th>
                      <th style={{ padding: "6px 8px", width: 100 }}>Height (mm)</th>
                      <th style={{ padding: "6px 8px", width: 90 }}>Sq. Ft</th>
                      <th style={{ padding: "6px 8px", width: 70 }}>Qty</th>
                      <th style={{ padding: "6px 8px", width: 100 }}>Rate (₹/sqft)</th>
                      <th style={{ padding: "6px 8px", width: 110, textAlign: "right" }}>Amount (₹)</th>
                      <th style={{ padding: "6px 8px", width: 40, textAlign: "center" }}>✕</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.lineItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ padding: "6px 8px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {products.length > 0 && (
                              <select
                                style={{ fontSize: 11, padding: "3px 6px" }}
                                value={item.productId || ""}
                                onChange={(e) => handleProductSelect(idx, e.target.value)}
                              >
                                <option value="">-- Choose from 34 Catalogue Products --</option>
                                {Array.from(new Set(products.map((p) => p.category).filter(Boolean))).map((cat) => (
                                  <optgroup key={cat} label={`📂 ${cat}`}>
                                    {products
                                      .filter((p) => p.category === cat)
                                      .map((p) => {
                                        const priceLabel =
                                          p.pricePerMeter > 0
                                            ? `₹${p.pricePerMeter}/m`
                                            : p.pricePerSqFt > 0
                                            ? `₹${p.pricePerSqFt}/sqft`
                                            : p.pricePerPiece > 0
                                            ? `₹${p.pricePerPiece}/pc`
                                            : "";
                                        return (
                                          <option key={p._id || p.id} value={p._id || p.id}>
                                            {p.slNo ? `[#${p.slNo}] ` : ""}{p.productCode} - {p.name} {priceLabel ? `(${priceLabel})` : ""}
                                          </option>
                                        );
                                      })}
                                  </optgroup>
                                ))}
                              </select>
                            )}
                            <input
                              style={{ fontSize: 12, padding: "4px 8px" }}
                              placeholder="Window design name (e.g. 3 TRACK WINDOW)"
                              value={item.description}
                              onChange={(e) => handleLineChange(idx, "description", e.target.value)}
                            />
                          </div>
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="number"
                            style={{ width: "100%", fontSize: 12, padding: "4px 6px" }}
                            placeholder="W (mm)"
                            value={item.width || ""}
                            onChange={(e) => handleLineChange(idx, "width", e.target.value)}
                          />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="number"
                            style={{ width: "100%", fontSize: 12, padding: "4px 6px" }}
                            placeholder="H (mm)"
                            value={item.height || ""}
                            onChange={(e) => handleLineChange(idx, "height", e.target.value)}
                          />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="number"
                            step="0.01"
                            style={{ width: "100%", fontSize: 12, padding: "4px 6px", background: "#f8fafc", fontWeight: 600 }}
                            value={item.sqFt || ""}
                            onChange={(e) => handleLineChange(idx, "sqFt", e.target.value)}
                            placeholder="Sq. Ft"
                          />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="number"
                            min="1"
                            style={{ width: "100%", fontSize: 12, padding: "4px 6px" }}
                            value={item.quantity || 1}
                            onChange={(e) => handleLineChange(idx, "quantity", e.target.value)}
                          />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="number"
                            style={{ width: "100%", fontSize: 12, padding: "4px 6px" }}
                            value={item.rate || ""}
                            onChange={(e) => handleLineChange(idx, "rate", e.target.value)}
                            placeholder="₹"
                          />
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#103567" }}>
                          ₹{Number(item.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}>
                          <button
                            type="button"
                            className="btn"
                            style={{ color: "#ef4444", padding: "2px 6px", fontSize: 11 }}
                            onClick={() => handleRemoveLine(idx)}
                            title="Remove item"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "2px solid #cbd5e1" }}>
                      <td colSpan={4} style={{ padding: "8px", textAlign: "right" }}>
                        TOTAL FABRICATION SQ. FT:
                      </td>
                      <td style={{ padding: "8px", color: "#103567" }}>
                        {totalSqFt.toFixed(2)}
                      </td>
                      <td></td>
                      <td style={{ padding: "8px", textAlign: "right" }}>GRAND TOTAL:</td>
                      <td style={{ padding: "8px", textAlign: "right", fontSize: 14, color: "#103567" }}>
                        ₹{totalAmount.toLocaleString("en-IN")}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Notes and Payment Terms */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                <div className="field">
                  <label>Payment Terms</label>
                  <input
                    value={form.paymentTerms}
                    onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                    placeholder="e.g. 50% Advance, 30% After Dispatch, 20% After Installation"
                  />
                </div>
                <div className="field">
                  <label>Proforma Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent to Customer</option>
                    <option value="paid">Advance Paid</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="converted">Converted</option>
                  </select>
                </div>
              </div>

              <div className="field" style={{ marginTop: 10 }}>
                <label>Commercial Notes &amp; Bank Details</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="DD UPVC WINDOWS SYSTEM bank terms, FOR delivery conditions, fabrication lead time..."
                />
              </div>

              {/* Summary Highlight Box */}
              <div
                style={{
                  background: "#103567",
                  color: "#ffffff",
                  padding: "12px 18px",
                  borderRadius: 6,
                  marginTop: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 11, opacity: 0.8, textTransform: "uppercase" }}>DD UPVC Windows System Summary</div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>
                    Total Sq. Ft: <b>{totalSqFt.toFixed(2)}</b> · Rate: <b>₹{form.perSqFtRate}/sq.ft</b>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, opacity: 0.8, textTransform: "uppercase" }}>Grand Total Amount</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#38bdf8" }}>
                    ₹{totalAmount.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            </div>

            <div className="modalfoot" style={{ display: "flex", justifyContent: "space-between", position: "sticky", bottom: 0, background: "#fff", zIndex: 10 }}>
              <div>
                {editingProforma && (
                  <button className="btn" style={{ color: "var(--red)" }} onClick={handleDeleteProforma}>
                    Delete Proforma
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button className="btn primary" onClick={handleSaveProforma}>
                  {editingProforma ? "Save Changes" : "Save Proforma Invoice"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
