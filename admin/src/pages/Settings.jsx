import React, { useState, useEffect } from "react";
import { App } from "antd";
import { settingsAPI } from "../services/api";

export default function Settings() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    companyLegalName: "DD UPVC WINDOW SYSTEMS",
    displayName: "DD UPVC",
    companyTitle: "DD UPVC\nWINDOWS",
    gstin: "23EVFPG6600A1ZB",
    address: "Kudri(Medical College Road), Shahdol, M.P.",
    city: "Shahdol",
    state: "Madhya Pradesh",
    pincode: "484001",
    phone: "+91 9826414729",
    email: "ddupvcwindowsystem@gmail.com",
    businessEmail: "ddupvcwindowsystem@gmail.com",
    whatsappSender: "+91 9826414729",
    invoicePrefix: "INV-",
    quotationPrefix: "QT-",
    proformaPrefix: "PI-",
    financialYear: "2026–27",
    bankDetails: [
      {
        id: "bank-1",
        bankName: "State Bank of India (SBI)",
        accountHolder: "DD UPVC WINDOW SYSTEMS",
        accountNumber: "44250720832",
        ifscCode: "SBIN0061553",
        branch: "Medical College Shahdol M.P.",
        isDefault: true,
      },
    ],
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await settingsAPI.get();
      if (res.data?.settings) {
        const s = res.data.settings;
        let banks = s.bankDetails;
        if (typeof banks === "string") {
          try {
            banks = JSON.parse(banks);
          } catch (e) {
            banks = [];
          }
        }
        if (!Array.isArray(banks) || banks.length === 0) {
          banks = [
            {
              id: "bank-1",
              bankName: "State Bank of India (SBI)",
              accountHolder: "DD UPVC WINDOW SYSTEMS",
              accountNumber: "44250720832",
              ifscCode: "SBIN0061553",
              branch: "Medical College Shahdol M.P.",
              isDefault: true,
            },
          ];
        }

        setForm({
          companyLegalName: s.companyLegalName || "DD UPVC WINDOW SYSTEMS",
          displayName: s.displayName || "DD UPVC",
          companyTitle: s.companyTitle || "DD UPVC\nWINDOWS",
          gstin: s.gstin !== undefined && s.gstin !== null ? s.gstin : "23EVFPG6600A1ZB",
          address: s.address || "Kudri(Medical College Road), Shahdol, M.P.",
          city: s.city || "Shahdol",
          state: s.state || "Madhya Pradesh",
          pincode: s.pincode || "",
          phone: s.phone || "+91 9826414729",
          email: s.email || s.businessEmail || "ddupvcwindowsystem@gmail.com",
          businessEmail: s.businessEmail || s.email || "ddupvcwindowsystem@gmail.com",
          whatsappSender: s.whatsappSender || "+91 9826414729",
          invoicePrefix: s.invoicePrefix || "INV-",
          quotationPrefix: s.quotationPrefix || "QT-",
          proformaPrefix: s.proformaPrefix || "PI-",
          financialYear: s.financialYear || "2026–27",
          bankDetails: banks,
        });
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleFieldChange = (field, val) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  // ── Bank Details Handlers ──────────────────────────────────────────────────
  const handleAddBank = () => {
    const newBank = {
      id: `bank-${Date.now()}`,
      bankName: "",
      accountHolder: form.companyLegalName || "DD UPVC WINDOW SYSTEMS",
      accountNumber: "",
      ifscCode: "",
      branch: "",
      isDefault: form.bankDetails.length === 0,
    };
    setForm((prev) => ({
      ...prev,
      bankDetails: [...prev.bankDetails, newBank],
    }));
  };

  const handleRemoveBank = (idx) => {
    if (form.bankDetails.length === 1) {
      message.warning("At least one bank account is required for invoices and quotations.");
      return;
    }
    const updated = form.bankDetails.filter((_, i) => i !== idx);
    // If the removed bank was default, make the first remaining bank default
    if (!updated.some((b) => b.isDefault) && updated.length > 0) {
      updated[0].isDefault = true;
    }
    setForm((prev) => ({ ...prev, bankDetails: updated }));
  };

  const handleBankChange = (idx, field, val) => {
    const updated = [...form.bankDetails];
    updated[idx] = { ...updated[idx], [field]: val };
    setForm((prev) => ({ ...prev, bankDetails: updated }));
  };

  const handleSetDefaultBank = (idx) => {
    const updated = form.bankDetails.map((b, i) => ({
      ...b,
      isDefault: i === idx,
    }));
    setForm((prev) => ({ ...prev, bankDetails: updated }));
    message.success(`Set ${form.bankDetails[idx].bankName || "Bank"} as default account for documents.`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsAPI.update(form);
      message.success("Settings & bank details saved successfully! All quotations, invoices and proformas will now use these updated details.");
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const primaryBank = form.bankDetails.find((b) => b.isDefault) || form.bankDetails[0] || {};

  return (
    <>
      <div className="crumb">
        DD UPVC <span style={{ margin: "0 6px" }}>/</span> SETTINGS &amp; INTEGRATIONS
      </div>

      <div className="pagehead">
        <div>
          <h1>Settings &amp; Workspace Configuration</h1>
          <p>Manage dynamic company legal profile, GSTIN, multiple bank accounts, and invoice/quotation defaults.</p>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={handleSave} disabled={saving} style={{ background: "#103567", borderColor: "#103567" }}>
            {saving ? "Saving..." : "💾 Save Settings"}
          </button>
        </div>
      </div>

      {/* ── Section 1: Company Profile & Tax Identifiers ──────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
          <div>
            <h2 style={{ margin: 0, color: "#103567" }}>1. Company Legal Profile &amp; Identifiers</h2>
            <small className="muted">This information dynamically prints in the header of all Quotations, Invoices, and Proformas.</small>
          </div>
        </div>
        <div className="cardbody">
          <div className="formgrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <div className="field">
              <label>Company Legal Name *</label>
              <input
                value={form.companyLegalName}
                onChange={(e) => handleFieldChange("companyLegalName", e.target.value)}
                placeholder="e.g. DD UPVC WINDOW SYSTEMS"
              />
            </div>
            <div className="field">
              <label>Display / Short Name</label>
              <input
                value={form.displayName}
                onChange={(e) => handleFieldChange("displayName", e.target.value)}
                placeholder="e.g. DD UPVC"
              />
            </div>
            <div className="field">
              <label>Company GSTIN *</label>
              <input
                value={form.gstin}
                onChange={(e) => handleFieldChange("gstin", e.target.value)}
                placeholder="e.g. 23EVFPG6600A1ZB"
              />
            </div>
            <div className="field">
              <label>Phone / Helpline *</label>
              <input
                value={form.phone}
                onChange={(e) => handleFieldChange("phone", e.target.value)}
                placeholder="e.g. +91 9826414729"
              />
            </div>
            <div className="field">
              <label>Business / Official Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => {
                  handleFieldChange("email", e.target.value);
                  handleFieldChange("businessEmail", e.target.value);
                }}
                placeholder="e.g. ddupvcwindowsystem@gmail.com"
              />
            </div>
            <div className="field">
              <label>WhatsApp Sender Number</label>
              <input
                value={form.whatsappSender}
                onChange={(e) => handleFieldChange("whatsappSender", e.target.value)}
                placeholder="e.g. +91 9826414729"
              />
            </div>
            <div className="field" style={{ gridColumn: "span 2" }}>
              <label>Factory / Office Street Address (Prints on documents) *</label>
              <input
                value={form.address}
                onChange={(e) => handleFieldChange("address", e.target.value)}
                placeholder="e.g. Kudri(Medical College Road), Shahdol, M.P."
              />
            </div>
            <div className="field">
              <label>City</label>
              <input
                value={form.city}
                onChange={(e) => handleFieldChange("city", e.target.value)}
                placeholder="e.g. Shahdol"
              />
            </div>
            <div className="field">
              <label>State</label>
              <input
                value={form.state}
                onChange={(e) => handleFieldChange("state", e.target.value)}
                placeholder="e.g. Madhya Pradesh"
              />
            </div>
            <div className="field">
              <label>Invoice Prefix</label>
              <input
                value={form.invoicePrefix}
                onChange={(e) => handleFieldChange("invoicePrefix", e.target.value)}
                placeholder="e.g. INV-"
              />
            </div>
            <div className="field">
              <label>Quotation Prefix</label>
              <input
                value={form.quotationPrefix}
                onChange={(e) => handleFieldChange("quotationPrefix", e.target.value)}
                placeholder="e.g. QT-"
              />
            </div>
            <div className="field">
              <label>Financial Year</label>
              <input
                value={form.financialYear}
                onChange={(e) => handleFieldChange("financialYear", e.target.value)}
                placeholder="e.g. 2026–27"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Multiple Bank Accounts Configuration ─────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
          <div>
            <h2 style={{ margin: 0, color: "#103567" }}>2. Bank Details &amp; Payment Accounts</h2>
            <small className="muted">
              Add multiple bank accounts. Click <b>"★ Set as Default"</b> on any account to display it automatically in the BANK DETAILS box on Quotations and Invoices.
            </small>
          </div>
          <button className="btn primary" onClick={handleAddBank} style={{ fontSize: 12 }}>
            ＋ Add Another Bank Account
          </button>
        </div>
        <div className="cardbody">
          {form.bankDetails && form.bankDetails.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {form.bankDetails.map((b, idx) => (
                <div
                  key={b.id || idx}
                  style={{
                    border: b.isDefault ? "2px solid #103567" : "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: 16,
                    background: b.isDefault ? "#f8fafc" : "#ffffff",
                    boxShadow: b.isDefault ? "0 2px 8px rgba(16, 53, 103, 0.08)" : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 800, color: "#103567", fontSize: 14 }}>
                        Bank Account #{idx + 1}
                      </span>
                      {b.isDefault ? (
                        <span className="pill green" style={{ fontWeight: 700 }}>
                          ★ Primary / Default on Documents
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: "3px 8px", fontSize: 11, borderColor: "#cbd5e1" }}
                          onClick={() => handleSetDefaultBank(idx)}
                        >
                          ☆ Set as Default
                        </button>
                      )}
                    </div>
                    {form.bankDetails.length > 1 && (
                      <button
                        type="button"
                        className="btn"
                        style={{ color: "var(--red)", borderColor: "#fca5a5", fontSize: 12, padding: "3px 8px" }}
                        onClick={() => handleRemoveBank(idx)}
                      >
                        🗑 Remove
                      </button>
                    )}
                  </div>

                  <div className="formgrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                    <div className="field">
                      <label>Bank Name *</label>
                      <input
                        value={b.bankName}
                        onChange={(e) => handleBankChange(idx, "bankName", e.target.value)}
                        placeholder="e.g. State Bank of India (SBI)"
                      />
                    </div>
                    <div className="field">
                      <label>A/C Holder Name *</label>
                      <input
                        value={b.accountHolder}
                        onChange={(e) => handleBankChange(idx, "accountHolder", e.target.value)}
                        placeholder="e.g. DD UPVC WINDOW SYSTEMS"
                      />
                    </div>
                    <div className="field">
                      <label>Account Number *</label>
                      <input
                        value={b.accountNumber}
                        onChange={(e) => handleBankChange(idx, "accountNumber", e.target.value)}
                        placeholder="e.g. 44250720832"
                      />
                    </div>
                    <div className="field">
                      <label>IFSC Code *</label>
                      <input
                        value={b.ifscCode}
                        onChange={(e) => handleBankChange(idx, "ifscCode", e.target.value)}
                        placeholder="e.g. SBIN0061553"
                      />
                    </div>
                    <div className="field" style={{ gridColumn: "span 2" }}>
                      <label>Branch Address / Name *</label>
                      <input
                        value={b.branch}
                        onChange={(e) => handleBankChange(idx, "branch", e.target.value)}
                        placeholder="e.g. Medical College Shahdol M.P."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 20, color: "#64748b" }}>
              No bank account found. Click <b>"＋ Add Another Bank Account"</b> above to configure payment bank details.
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Live Document Header & Bank Details Preview ───────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
          <div>
            <h2 style={{ margin: 0, color: "#103567" }}>3. Live Preview on Quotations &amp; Invoices</h2>
            <small className="muted">This is how your dynamic company header and default bank information will appear on client documents:</small>
          </div>
          <span className="pill blue">Real-time Preview</span>
        </div>
        <div className="cardbody" style={{ background: "#f8fafc", padding: "24px" }}>
          <div
            style={{
              background: "#ffffff",
              padding: "24px 30px",
              borderRadius: 6,
              boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
              border: "1px solid #e2e8f0",
              maxWidth: "760px",
              margin: "0 auto",
            }}
          >
            {/* Header Preview */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    background: "#103567",
                    borderRadius: 4,
                    padding: 5,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 2,
                  }}
                >
                  <span style={{ background: "#38bdf8", borderRadius: 1 }}></span>
                  <span style={{ background: "#38bdf8", borderRadius: 1 }}></span>
                  <span style={{ background: "#38bdf8", borderRadius: 1 }}></span>
                  <span style={{ background: "#38bdf8", borderRadius: 1 }}></span>
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#103567", lineHeight: 1.1 }}>
                    {form.displayName || "DD UPVC"} WINDOWS
                  </h2>
                  <p style={{ margin: "2px 0", fontSize: 12, fontWeight: 700, color: "#103567" }}>
                    {form.companyLegalName || "DD UPVC WINDOWS SYSTEM"}
                  </p>
                  <p style={{ margin: "1px 0", fontSize: 11, color: "#475569" }}>{form.address || "Company Address"}</p>
                  <p style={{ margin: "1px 0", fontSize: 11, color: "#475569" }}>Phone: {form.phone || "+91 0000000000"}</p>
                  <p style={{ margin: "1px 0", fontSize: 11, color: "#475569" }}>{form.email || "email@domain.com"}</p>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#103567" }}>GSTIN NO.</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{form.gstin || "23XXXXXXXXXX"}</div>
                <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
                  Quote No: <b style={{ color: "#0f172a" }}>{form.quotationPrefix}2026-0001</b>
                </div>
              </div>
            </div>

            {/* Bank Details Banner Preview */}
            <div
              style={{
                border: "1.5px solid #103567",
                borderRadius: 4,
                overflow: "hidden",
                maxWidth: "340px",
                marginLeft: "auto",
              }}
            >
              <div
                style={{
                  background: "#103567",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 11,
                  padding: "4px 10px",
                  textTransform: "uppercase",
                  textAlign: "center",
                }}
              >
                BANK DETAILS
              </div>
              <div style={{ padding: "8px 12px", fontSize: 11, lineHeight: 1.5, background: "#ffffff" }}>
                <p style={{ margin: "2px 0" }}>
                  <span style={{ fontWeight: 600, color: "#64748b", display: "inline-block", width: 95 }}>A/C HOLDER:</span>
                  <b style={{ color: "#0f172a" }}>{primaryBank.accountHolder || form.companyLegalName}</b>
                </p>
                <p style={{ margin: "2px 0" }}>
                  <span style={{ fontWeight: 600, color: "#64748b", display: "inline-block", width: 95 }}>ACCOUNT NO:-</span>
                  <b style={{ color: "#0f172a" }}>{primaryBank.accountNumber || "—"}</b>
                </p>
                <p style={{ margin: "2px 0" }}>
                  <span style={{ fontWeight: 600, color: "#64748b", display: "inline-block", width: 95 }}>IFSC CODE :-</span>
                  <b style={{ color: "#0f172a" }}>{primaryBank.ifscCode || "—"}</b>
                </p>
                <p style={{ margin: "2px 0" }}>
                  <span style={{ fontWeight: 600, color: "#64748b", display: "inline-block", width: 95 }}>BRANCH :-</span>
                  <b style={{ color: "#0f172a" }}>{primaryBank.branch || "—"}</b>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 30 }}>
        <button className="btn primary" onClick={handleSave} disabled={saving} style={{ background: "#103567", borderColor: "#103567", padding: "8px 24px", fontSize: 14 }}>
          {saving ? "Saving Changes..." : "💾 Save Settings & Bank Details"}
        </button>
      </div>
    </>
  );
}
