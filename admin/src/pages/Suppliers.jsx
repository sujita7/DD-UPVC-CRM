import React, { useState, useEffect } from "react";
import { App } from "antd";
import { supplierAPI } from "../services/api";

function statusPill(s) {
  const x = (s || "").toLowerCase();
  let c = /active|approved|paid/.test(x) ? "green" : /inactive|blocked/.test(x) ? "red" : "amber";
  return <span className={`pill ${c}`}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : "Active"}</span>;
}

export default function Suppliers() {
  const { message } = App.useApp();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All statuses");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form, setForm] = useState({
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    taxNumber: "",
    paymentTerms: 30,
    category: "Profiles",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    status: "active",
  });

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await supplierAPI.list({ limit: 100 });
      setSuppliers(res.data?.suppliers || res.data?.data?.suppliers || []);
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleOpenModal = (supplier = null) => {
    setEditingSupplier(supplier);
    if (supplier) {
      setForm({
        companyName: supplier.companyName || "",
        contactPerson: supplier.contactPerson || "",
        email: supplier.email || "",
        phone: supplier.phone || "",
        taxNumber: supplier.taxNumber || "",
        paymentTerms: supplier.paymentTerms || 30,
        category: supplier.category || "Profiles",
        bankName: supplier.bankDetails?.bankName || "",
        accountNumber: supplier.bankDetails?.accountNumber || "",
        ifscCode: supplier.bankDetails?.ifscCode || "",
        status: supplier.status || "active",
      });
    } else {
      setForm({
        companyName: "",
        contactPerson: "",
        email: "",
        phone: "",
        taxNumber: "",
        paymentTerms: 30,
        category: "Profiles",
        bankName: "",
        accountNumber: "",
        ifscCode: "",
        status: "active",
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.companyName.trim()) {
      message.error("Supplier company name is required.");
      return;
    }
    try {
      const payload = {
        companyName: form.companyName.trim(),
        contactPerson: form.contactPerson.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        taxNumber: form.taxNumber.trim(),
        paymentTerms: Number(form.paymentTerms) || 30,
        category: form.category,
        status: form.status,
        bankDetails: {
          bankName: form.bankName,
          accountNumber: form.accountNumber,
          ifscCode: form.ifscCode,
        },
      };

      if (editingSupplier) {
        await supplierAPI.update(editingSupplier._id, payload);
        message.success("Supplier updated successfully.");
      } else {
        await supplierAPI.create(payload);
        message.success("Supplier registered successfully.");
      }
      setIsModalOpen(false);
      fetchSuppliers();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to save supplier.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this supplier?")) return;
    try {
      await supplierAPI.delete(id);
      message.success("Supplier deleted.");
      fetchSuppliers();
    } catch (err) {
      message.error("Failed to delete supplier.");
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const matches =
      (s.companyName || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.contactPerson || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.phone || "").includes(search);
    if (!matches) return false;
    if (filterStatus === "All statuses") return true;
    return (s.status || "active").toLowerCase() === filterStatus.toLowerCase();
  });

  const totalPayable = suppliers.reduce((acc, s) => acc + (s.financialSummary?.outstandingPayable || 0), 0);
  const activeCount = suppliers.filter((s) => (s.status || "active") === "active").length;

  return (
    <>
      <div className="crumb">
        DD UPVC <span style={{ margin: "0 6px" }}>/</span> PURCHASES &amp; SUPPLIERS
      </div>
      <div className="pagehead">
        <div>
          <h1>Purchases &amp; Suppliers</h1>
          <p>Manage supplier rates, purchase orders, material deliveries and trade payables.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => message.info("Export prepared in connected application.")}>
            ⇩ Export
          </button>
          <button className="btn primary" onClick={() => handleOpenModal()}>
            ＋ Add supplier
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid stats">
        <div className="card stat">
          <div className="statrow">
            <span>Total vendors</span>
            <span className="staticon">⇄</span>
          </div>
          <strong>{suppliers.length}</strong>
          <span className="trend">Raw material suppliers</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Active vendors</span>
            <span className="staticon">✓</span>
          </div>
          <strong>{activeCount}</strong>
          <span className="trend">Approved for purchases</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Outstanding payables</span>
            <span className="staticon">₹</span>
          </div>
          <strong>₹{totalPayable.toLocaleString("en-IN")}</strong>
          <span className="trend">Due against material POs</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Category breakdown</span>
            <span className="staticon">▦</span>
          </div>
          <strong>Profiles &amp; Glass</strong>
          <span className="trend">Primary raw materials</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card">
        <div className="cardhead">
          <h2>
            Purchases &amp; Suppliers <span className="muted" style={{ fontWeight: 400 }}>({filteredSuppliers.length})</span>
          </h2>
          <button className="btn" onClick={() => message.info("Filter panel ready.")}>
            ☷ Filters
          </button>
        </div>

        <div className="toolbar" style={{ padding: "14px 16px 0", marginBottom: 0 }}>
          <input
            placeholder="Search suppliers by name, contact, phone, GST…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option>All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>PO / Vendor ID</th>
                <th>Supplier / Company</th>
                <th>Category</th>
                <th>Contact</th>
                <th>GST / Tax ID</th>
                <th>Outstanding Payable</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.length > 0 ? (
                filteredSuppliers.map((r, i) => (
                  <tr key={r._id || i}>
                    <td>
                      <b>{r.supplierId || `SUP-${800 + i}`}</b>
                    </td>
                    <td>
                      <div className="customer">
                        <div className="miniavatar">
                          {(r.companyName || "S").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <b>{r.companyName}</b>
                          <small>{r.contactPerson ? `Contact: ${r.contactPerson}` : r.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>{r.category || "Profiles"}</td>
                    <td>
                      <div>{r.email || "—"}</div>
                      <small className="muted">{r.phone || ""}</small>
                    </td>
                    <td>{r.taxNumber || "—"}</td>
                    <td>
                      <b style={{ color: (r.financialSummary?.outstandingPayable || 0) > 0 ? "var(--red)" : "inherit" }}>
                        ₹{Number(r.financialSummary?.outstandingPayable || 0).toLocaleString("en-IN")}
                      </b>
                    </td>
                    <td>{statusPill(r.status || "active")}</td>
                    <td>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <button className="btn" style={{ padding: "6px 9px" }} onClick={() => handleOpenModal(r)}>
                          Edit ↗
                        </button>
                        <button
                          className="btn"
                          style={{ padding: "6px 9px", color: "var(--red)" }}
                          onClick={() => handleDelete(r._id)}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8">
                    <div className="emptyhint">
                      <b>No suppliers found</b>
                      {loading ? "Loading suppliers..." : "Click '+ Add supplier' to register a vendor."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 16px", color: "#8390a2", fontSize: 11, borderTop: "1px solid var(--line)" }}>
          Showing {filteredSuppliers.length} records · DD UPVC Supplier Registry
        </div>
      </div>



      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="cardhead">
              <h2>{editingSupplier ? "Edit Supplier Details" : "Register New Supplier"}</h2>
              <button className="btn" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="cardbody">
              <div className="formgrid">
                <div className="field">
                  <label>Supplier / Company Name *</label>
                  <input
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    placeholder="e.g. Prime Profiles / ClearView Glass"
                  />
                </div>
                <div className="field">
                  <label>Contact Person</label>
                  <input
                    value={form.contactPerson}
                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                    placeholder="e.g. Sales Manager"
                  />
                </div>
                <div className="field">
                  <label>Material Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    <option value="Profiles">Profiles (uPVC / Aluminium)</option>
                    <option value="Glass">Glass (Double glazed / Toughened)</option>
                    <option value="Hardware">Hardware (Handles, Hinges, Locks)</option>
                    <option value="Accessories">Accessories &amp; Gaskets</option>
                    <option value="Consumables">Consumables &amp; Silicones</option>
                  </select>
                </div>
                <div className="field">
                  <label>Account Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="field">
                  <label>Billing Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="sales@supplier.com"
                  />
                </div>
                <div className="field">
                  <label>Phone Number</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
                <div className="field">
                  <label>GST / Tax Number</label>
                  <input
                    value={form.taxNumber}
                    onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
                    placeholder="GSTIN"
                  />
                </div>
                <div className="field">
                  <label>Payment Terms (Days)</label>
                  <input
                    type="number"
                    value={form.paymentTerms}
                    onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="modalfoot">
              <button className="btn" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={handleSave}>
                {editingSupplier ? "Update Supplier" : "Register Supplier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
