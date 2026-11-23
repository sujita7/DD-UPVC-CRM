import React, { useState, useEffect } from "react";
import { App } from "antd";
import { customerAPI } from "../services/api";

function statusPill(s) {
  const x = (s || "").toLowerCase();
  let c = /active|paid|approved/.test(x) ? "green" : /inactive|overdue/.test(x) ? "red" : "amber";
  return <span className={`pill ${c}`}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : "Active"}</span>;
}

export default function Customers() {
  const { message } = App.useApp();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All statuses");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState({
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    taxNumber: "",
    paymentTerms: 30,
    creditLimit: 500000,
    street: "",
    city: "",
    state: "",
    zipCode: "",
    status: "active",
  });

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await customerAPI.list({ limit: 100 });
      setCustomers(res.data?.customers || res.data?.data?.customers || []);
    } catch (err) {
      console.error("Failed to load customers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleOpenModal = (customer = null) => {
    setEditingCustomer(customer);
    if (customer) {
      setForm({
        companyName: customer.companyName || "",
        contactPerson: customer.contactPerson || "",
        email: customer.email || "",
        phone: customer.phone || "",
        taxNumber: customer.taxNumber || "",
        paymentTerms: customer.paymentTerms || 30,
        creditLimit: customer.creditLimit || 500000,
        street: customer.address?.street || "",
        city: customer.address?.city || "",
        state: customer.address?.state || "",
        zipCode: customer.address?.zipCode || "",
        status: customer.status || "active",
      });
    } else {
      setForm({
        companyName: "",
        contactPerson: "",
        email: "",
        phone: "",
        taxNumber: "",
        paymentTerms: 30,
        creditLimit: 500000,
        street: "",
        city: "",
        state: "",
        zipCode: "",
        status: "active",
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.companyName.trim()) {
      message.error("Company / Customer name is required.");
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
        creditLimit: Number(form.creditLimit) || 0,
        status: form.status,
        address: {
          street: form.street,
          city: form.city,
          state: form.state,
          zipCode: form.zipCode,
          country: "India",
        },
      };

      if (editingCustomer) {
        await customerAPI.update(editingCustomer._id, payload);
        message.success("Customer updated successfully.");
      } else {
        await customerAPI.create(payload);
        message.success("Customer created successfully.");
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to save customer.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this customer?")) return;
    try {
      await customerAPI.delete(id);
      message.success("Customer deleted.");
      fetchCustomers();
    } catch (err) {
      message.error("Failed to delete customer.");
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const matches =
      (c.companyName || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.contactPerson || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").includes(search);
    if (!matches) return false;
    if (filterStatus === "All statuses") return true;
    return (c.status || "active").toLowerCase() === filterStatus.toLowerCase();
  });

  const totalInvoiced = customers.reduce((acc, c) => acc + (c.financialSummary?.totalInvoiced || 0), 0);
  const totalOutstanding = customers.reduce((acc, c) => acc + (c.financialSummary?.outstandingBalance || 0), 0);
  const activeCount = customers.filter((c) => (c.status || "active") === "active").length;

  return (
    <>
      <div className="crumb">
        DD UPVC <span style={{ margin: "0 6px" }}>/</span> CRM &amp; CUSTOMERS
      </div>
      <div className="pagehead">
        <div>
          <h1>CRM &amp; Customers</h1>
          <p>Manage leads, customer profiles, site visits, invoices and receivables ledger.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => message.info("Export prepared in connected application.")}>
            ⇩ Export
          </button>
          <button className="btn primary" onClick={() => handleOpenModal()}>
            ＋ Add customer
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid stats">
        <div className="card stat">
          <div className="statrow">
            <span>Total customers</span>
            <span className="staticon">♙</span>
          </div>
          <strong>{customers.length}</strong>
          <span className="trend">Commercial client accounts</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Active accounts</span>
            <span className="staticon">✓</span>
          </div>
          <strong>{activeCount}</strong>
          <span className="trend">Verified buyers</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Total invoiced</span>
            <span className="staticon">▧</span>
          </div>
          <strong>₹{totalInvoiced.toLocaleString("en-IN")}</strong>
          <span className="trend">Cumulative billed</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Outstanding dues</span>
            <span className="staticon">₹</span>
          </div>
          <strong>₹{totalOutstanding.toLocaleString("en-IN")}</strong>
          <span className="trend">Pending collections</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card">
        <div className="cardhead">
          <h2>
            CRM &amp; Customers <span className="muted" style={{ fontWeight: 400 }}>({filteredCustomers.length})</span>
          </h2>
          <button className="btn" onClick={() => message.info("Filter panel ready.")}>
            ☷ Filters
          </button>
        </div>

        <div className="toolbar" style={{ padding: "14px 16px 0", marginBottom: 0 }}>
          <input
            placeholder="Search customers by company, person, phone, email…"
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
                <th>Customer ID</th>
                <th>Customer / Company</th>
                <th>Contact Info</th>
                <th>City / State</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((r, i) => (
                  <tr key={r._id || i}>
                    <td>
                      <b>{r.customerId || `CUS-${1000 + i}`}</b>
                    </td>
                    <td>
                      <div className="customer">
                        <div className="miniavatar">
                          {(r.companyName || r.contactPerson || "C")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <b>{r.companyName}</b>
                          <small>{r.contactPerson ? `Contact: ${r.contactPerson}` : r.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>{r.email || "—"}</div>
                      <small className="muted">{r.phone || ""}</small>
                    </td>
                    <td>
                      {r.address?.city ? `${r.address.city}, ${r.address.state || ""}` : "—"}
                    </td>
                    <td>
                      <b style={{ color: (r.financialSummary?.outstandingBalance || 0) > 0 ? "var(--amber)" : "var(--green)" }}>
                        ₹{Number(r.financialSummary?.outstandingBalance || 0).toLocaleString("en-IN")}
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
                  <td colSpan="7">
                    <div className="emptyhint">
                      <b>No customer accounts found</b>
                      {loading ? "Loading customers..." : "Click '+ Add customer' to create one."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 16px", color: "#8390a2", fontSize: 11, borderTop: "1px solid var(--line)" }}>
          Showing {filteredCustomers.length} records · DD UPVC Customer Ledger
        </div>
      </div>



      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="cardhead">
              <h2>{editingCustomer ? "Edit Customer Details" : "Register New Customer"}</h2>
              <button className="btn" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="cardbody">
              <div className="formgrid">
                <div className="field">
                  <label>Company / Customer Name *</label>
                  <input
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    placeholder="e.g. Rajesh Sharma / Global Infra"
                  />
                </div>
                <div className="field">
                  <label>Contact Person</label>
                  <input
                    value={form.contactPerson}
                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                    placeholder="e.g. Mr. Sharma"
                  />
                </div>
                <div className="field">
                  <label>Billing Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="billing@company.com"
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
                  <label>GST / VAT / Tax ID</label>
                  <input
                    value={form.taxNumber}
                    onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
                    placeholder="GSTIN"
                  />
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
                <div className="field full">
                  <label>Site / Street Address</label>
                  <input
                    value={form.street}
                    onChange={(e) => setForm({ ...form, street: e.target.value })}
                    placeholder="Address, Sector, Area"
                  />
                </div>
                <div className="field">
                  <label>City</label>
                  <input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="City"
                  />
                </div>
                <div className="field">
                  <label>State</label>
                  <input
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    placeholder="State"
                  />
                </div>
              </div>
            </div>
            <div className="modalfoot">
              <button className="btn" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={handleSave}>
                {editingCustomer ? "Update Customer" : "Save Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
