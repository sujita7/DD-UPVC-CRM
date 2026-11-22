import React, { useRef, useState, useEffect } from "react";
import dayjs from "dayjs";
import { App } from "antd";
import { invoiceAPI, quotationAPI, settingsAPI } from "../services/api";

// Address sanitizer to avoid "[object Object]" in UI or printed documents
function extractAddressString(addr) {
  if (!addr) return "";
  if (typeof addr === "string") {
    const trimmed = addr.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "object" && parsed !== null) {
          return parsed.street || parsed.address || parsed.line1 || parsed.city || "";
        }
      } catch (e) {}
    }
    return addr;
  }
  if (typeof addr === "object") {
    return addr.street || addr.address || addr.line1 || addr.city || "";
  }
  return String(addr);
}

export default function ProformaInvoiceTemplate({ proforma, quotation, invoice, type = "proforma", onClose, onRefresh, settings: propSettings }) {
  const { message, modal } = App.useApp();
  const printRef = useRef(null);
  const [settings, setSettings] = useState(propSettings || null);

  useEffect(() => {
    if (propSettings) {
      setSettings(propSettings);
    }
  }, [propSettings]);

  useEffect(() => {
    let isMounted = true;
    settingsAPI
      .get()
      .then((res) => {
        if (isMounted && res.data?.settings) {
          setSettings(res.data.settings);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const doc = quotation || proforma || invoice;
  if (!doc) return null;

  const isInvoice = type === "invoice" || (doc.invoiceNumber && !doc.invoiceNumber.startsWith("PI-") && type !== "proforma" && type !== "quotation");
  const isQuote = type === "quotation" || (Boolean(quotation) && type !== "invoice" && type !== "proforma") || (Boolean(doc.quotationNumber) && !doc.invoiceNumber && type !== "invoice");
  const isProforma = !isQuote && !isInvoice;
  const docTitle = isQuote ? "QUOTATION" : isInvoice ? "TAX INVOICE" : "PROFORMA INVOICE";
  const docTypeLabel = isQuote ? "Quotation" : isInvoice ? "Tax Invoice" : "Proforma Invoice";

  const cust = doc.customerSnapshot || doc.customer || {};
  let billing = cust.billingAddress;
  if (typeof billing === "string") {
    try {
      billing = JSON.parse(billing);
    } catch (e) {
      billing = {};
    }
  }

  // Dynamic Customer Details (Sanitized against [object Object])
  const billToName = doc.clientName || cust.companyName || cust.name || doc.customerName || "MR. ABHISHEK JAIN";
  const billToAddress = extractAddressString(doc.clientAddress) || extractAddressString(cust.address) || extractAddressString(billing?.street) || extractAddressString(billing?.address) || "";
  const billToCity = extractAddressString(doc.clientCity) || extractAddressString(billing?.city) || extractAddressString(cust.city) || "JABALPUR";
  const billToState = extractAddressString(doc.clientState) || extractAddressString(billing?.state) || extractAddressString(cust.state) || "MADHYA PRADESH";
  const billToGst = doc.clientGst || cust.gstNumber || cust.taxNumber || "";

  // Dynamic Company Header & Brand from Settings
  const companyTitle = settings?.companyTitle || doc.companyTitle || `${settings?.displayName || "DD UPVC"} WINDOWS`;
  const companyName = settings?.companyLegalName || doc.companyName || "DD UPVC WINDOWS SYSTEM";
  const companyAddress = settings?.address || doc.companyAddress || "Kudri(Medical College Road), Shahdol, M.P.";
  const companyPhone = settings?.phone || doc.companyPhone || "+91 9826414729";
  const companyEmail = settings?.email || settings?.businessEmail || doc.companyEmail || "ddupvcwindowsystem@gmail.com";
  const companyGstin =
    settings?.gstin ||
    (doc.companyGstin && doc.companyGstin !== "23EVFPG6600A1ZB" ? doc.companyGstin : "") ||
    doc.companyGstin ||
    doc.gstin ||
    "";

  // Dynamic Bank Details: Use doc.bankDetails if populated, otherwise use Primary/Default bank from Settings
  let defaultSettingsBank = {};
  if (settings?.bankDetails) {
    let bList = settings.bankDetails;
    if (typeof bList === "string") {
      try {
        bList = JSON.parse(bList);
      } catch (e) {
        bList = [];
      }
    }
    if (Array.isArray(bList)) {
      defaultSettingsBank = bList.find((b) => b.isDefault) || bList[0] || {};
    }
  }

  const bank =
    doc.bankDetails && (doc.bankDetails.accountNumber || doc.bankDetails.accountHolder)
      ? doc.bankDetails
      : defaultSettingsBank;

  const acHolder = bank.accountHolder || bank.acHolder || defaultSettingsBank.accountHolder || "DD UPVC WINDOW SYSTEMS";
  const acNumber = bank.accountNumber || bank.acNumber || bank.accountNo || defaultSettingsBank.accountNumber || "44250720832";
  const ifscCode = bank.ifscCode || bank.ifsc || defaultSettingsBank.ifscCode || "SBIN0061553";
  const branch = bank.branch || defaultSettingsBank.branch || "Medical College Shahdol M.P.";

  // Dynamic Terms & Conditions
  const rawTerms = doc.termsAndConditions || "";
  const termsList = rawTerms
    ? rawTerms
        .split("\n")
        .map((t) => t.replace(/^\d+[\.\)]\s*/, "").trim())
        .filter(Boolean)
    : [
        "Installation work will be carried out on FOR basis as per finalized scope.",
        "Total project duration shall be 25 to 35 working days, starting after advance payment.",
        "50% advance, 30% after dispatch (before unloading), and 20% after installation is mandatory.",
        "All payments must be cleared as per schedule to ensure smooth and timely execution.",
      ];

  const rawItems = Array.isArray(doc.items) && doc.items.length > 0
    ? doc.items
    : Array.isArray(doc.lineItems) && doc.lineItems.length > 0
    ? doc.lineItems
    : [];

  const rawMaterialsList = Array.isArray(doc.rawMaterials)
    ? doc.rawMaterials
    : typeof doc.rawMaterials === "string"
    ? (() => {
        try {
          return JSON.parse(doc.rawMaterials) || [];
        } catch (e) {
          return [];
        }
      })()
    : [];

  // Filter ONLY valid configured window items (Exclude empty placeholders or zero records)
  const validWindowItems = rawItems.filter((it) => {
    const hasName = Boolean((it.description && it.description.trim() && it.description !== "Custom Window") || (it.windowType && it.windowType.trim()));
    const hasDims = (Number(it.width) > 0 && Number(it.height) > 0) || Number(it.sqFt) > 0;
    const hasCost = Number(it.amount || it.total || it.unitPrice || it.rate) > 0;
    return hasName || (hasDims && hasCost);
  });

  // Filter ONLY valid configured raw materials
  const validRawMaterials = rawMaterialsList.filter((rm) => {
    const hasDesc = Boolean(rm.description && rm.description.trim());
    const hasMeter = Number(rm.meter) > 0 || Number(rm.sqFt) > 0;
    const hasCost = Number(rm.total || rm.rate || rm.unitPrice) > 0;
    return hasDesc || hasMeter || hasCost;
  });

  const specs = doc.specifications || {};
  const series = specs.series || doc.profileSeries || doc.series || "INVENTA";
  const glass = specs.glass || doc.glassType || doc.glass || "10 MM CLEAR TUFF GLASS";
  const sash = specs.sash || doc.sash || "79MM SLIDING SASH";
  const mesh = specs.mesh || doc.mesh || "SS MESH 304G NATURAL";

  // Calculate totals with 100% precision
  const totalSqFt = validWindowItems.reduce((acc, it) => {
    const s = Number(it.sqFt || it.area || (it.width && it.height ? (it.width * it.height) / 90900 : 0));
    return acc + s * (Number(it.quantity) || 1);
  }, 0);

  const windowSubtotal = Math.round(
    validWindowItems.reduce((acc, it) => acc + (Number(it.amount || it.total || (it.quantity * it.unitPrice)) || 0), 0)
  );

  const rawSubtotal = Math.round(
    validRawMaterials.reduce((acc, rm) => {
      const meter = Number(rm.meter) || 0;
      const sqFt = Number(rm.sqFt) || 0;
      const qty = Number(rm.quantity) || 1;
      const rate = Number(rm.rate !== undefined && rm.rate !== null && rm.rate !== "" ? rm.rate : rm.unitPrice) || 0;
      const t = Number(rm.total) || (rate * (sqFt > 0 ? sqFt : meter > 0 ? meter : 1) * qty);
      return acc + t;
    }, 0)
  );

  const grossSubtotal = windowSubtotal + rawSubtotal;

  const discountPercent = Math.min(
    100,
    Math.max(
      0,
      Number(
        doc.discountPercentage !== undefined && doc.discountPercentage !== null && doc.discountPercentage !== ""
          ? doc.discountPercentage
          : doc.discountValue || 0
      )
    )
  );

  const discountAmt = Math.round(
    doc.discountAmount !== undefined && doc.discountAmount !== null && doc.discountAmount !== ""
      ? Number(doc.discountAmount)
      : (grossSubtotal * discountPercent) / 100
  );

  const taxableSubtotal = Math.max(0, grossSubtotal - discountAmt);

  const taxAmount =
    doc.taxAmount !== undefined && doc.taxAmount !== null && doc.taxAmount !== ""
      ? Math.round(Number(doc.taxAmount))
      : Math.round(taxableSubtotal * 0.18);

  const grandTotal =
    doc.totalAmount !== undefined && doc.totalAmount !== null && doc.totalAmount !== ""
      ? Math.round(Number(doc.totalAmount))
      : taxableSubtotal + taxAmount;

  const perSqFtRate = totalSqFt > 0 ? Math.round(windowSubtotal / totalSqFt) : (Number(doc.perSqFtRate) || 690);

  const handlePrint = () => {
    window.print();
  };

  const handleSendEmail = async () => {
    const defaultEmail = cust.email || "";
    const emailTo = window.prompt(
      `Enter client email address to send ${docTypeLabel}:`,
      defaultEmail
    );
    if (!emailTo) return;

    try {
      if (isQuote) {
        const res = await quotationAPI.send(doc._id, { emailTo });
        modal.success({
          title: "Quotation Sent Successfully!",
          content: (
            <div style={{ paddingTop: 8 }}>
              <p>The quotation document <b>{docNumber}</b> has been successfully dispatched to:</p>
              <p style={{ color: "#166534", fontWeight: 700, fontSize: 15, margin: "8px 0" }}>✉ {emailTo}</p>
              <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                The customer will receive the complete window specification, rate sheet, bank details, and terms &amp; conditions in their inbox.
              </p>
            </div>
          ),
          okText: "Done",
          okButtonProps: { style: { background: "#103567", borderColor: "#103567" } },
        });
        message.success(res.data?.message || `Quotation sent successfully to ${emailTo}`);
      } else {
        const res = await invoiceAPI.send(doc._id, { emailTo });
        modal.success({
          title: `${docTypeLabel} Sent Successfully!`,
          content: (
            <div style={{ paddingTop: 8 }}>
              <p>The {docTypeLabel.toLowerCase()} document <b>{docNumber}</b> has been successfully dispatched to:</p>
              <p style={{ color: "#166534", fontWeight: 700, fontSize: 15, margin: "8px 0" }}>✉ {emailTo}</p>
            </div>
          ),
          okText: "Done",
          okButtonProps: { style: { background: "#103567", borderColor: "#103567" } },
        });
        message.success(res.data?.message || `${docTypeLabel} sent successfully to ${emailTo}`);
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to send email. Check network or server configuration.");
    }
  };

  const docNumber = doc.quotationNumber || doc.invoiceNumber || (isQuote ? "QT-2026-0001" : isInvoice ? "INV-2026-0001" : "PI-2026-0001");
  const docDate = doc.quotationDate || doc.invoiceDate;

  return (
    <div className="proforma-template-overlay">
      <div className="proforma-template-container">
        {/* Top Control Bar (Hidden in Print) */}
        <div className="proforma-actions-bar no-print">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 700, color: "var(--navy)", fontSize: 15 }}>
              {docTypeLabel} Preview ({docNumber})
            </span>
            <span className="pill blue">Client Ready</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={handleSendEmail} style={{ background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }}>
              ✉ Send on Client Email
            </button>
            <button className="btn primary" onClick={handlePrint} style={{ background: "#103567", borderColor: "#103567" }}>
              🖨 Download / Print PDF
            </button>
            <button className="btn" onClick={onClose}>
              ✕ Close
            </button>
          </div>
        </div>

        {/* Printable Document - Exact Match to Abhishek Jain DD UPVC Template */}
        <div className="proforma-paper-sheet" ref={printRef} id="printable-proforma">
          {/* Header */}
          <div className="ddupvc-header">
            <div className="ddupvc-brand">
              <div className="ddupvc-logo-box">
                <div className="ddupvc-logo-grid">
                  <span></span><span></span><span></span><span></span>
                </div>
              </div>
              <div className="ddupvc-company-info">
                <h1 className="ddupvc-company-title" style={{ whiteSpace: "pre-line" }}>{companyTitle}</h1>
                <p className="ddupvc-company-name">{companyName}</p>
                <p>{companyAddress}</p>
                <p>Phone: {companyPhone}</p>
                <p>{companyEmail}</p>
              </div>
            </div>

            <div className="ddupvc-title-center">
              <h2>{docTitle}</h2>
            </div>

            <div className="ddupvc-meta-right">
              <div className="ddupvc-gstin-label">GSTIN NO.</div>
              <div className="ddupvc-gstin-val">{companyGstin}</div>
              <div className="ddupvc-meta-row" style={{ marginTop: 12 }}>
                <span className="meta-lbl">Date:-</span>
                <span className="meta-val">{docDate ? dayjs(docDate).format("M/D/YYYY") : dayjs().format("M/D/YYYY")}</span>
              </div>
              <div className="ddupvc-meta-row">
                <span className="meta-lbl">{isQuote ? "Quote No:-" : "Invoice No:-"}</span>
                <span className="meta-val">{docNumber}</span>
              </div>
            </div>
          </div>

          {/* Two-Column Info: Bill To & Bank Details */}
          <div className="ddupvc-info-grid">
            <div className="ddupvc-info-box">
              <div className="ddupvc-box-banner">Bill To</div>
              <div className="ddupvc-box-content">
                <p className="ddupvc-billto-name">{billToName}</p>
                {billToAddress && <p className="ddupvc-billto-addr">{billToAddress}</p>}
                <p className="ddupvc-billto-addr">{billToCity}, {billToState}</p>
                {cust.phone && <p>Phone: {cust.phone}</p>}
                {cust.email && <p>Email: {cust.email}</p>}
                {billToGst && <p style={{ fontWeight: 600, color: "#103567", marginTop: 4 }}>GSTIN: {billToGst}</p>}
              </div>
            </div>

            <div className="ddupvc-info-box">
              <div className="ddupvc-box-banner">BANK DETAILS</div>
              <div className="ddupvc-box-content">
                <p><span className="b-lbl">A/C HOLDER:</span> <span className="b-val">{acHolder}</span></p>
                <p><span className="b-lbl">ACCOUNT NO:-</span> <span className="b-val">{acNumber}</span></p>
                <p><span className="b-lbl">IFSC CODE :-</span> <span className="b-val">{ifscCode}</span></p>
                <p><span className="b-lbl">BRANCH :-</span> <span className="b-val">{branch}</span></p>
              </div>
            </div>
          </div>

          {/* Window Specification Highlight Banner (Shown only when Windows items exist) */}
          {validWindowItems.length > 0 && (
            <div className="ddupvc-spec-banner">
              <div className="ddupvc-spec-item">
                <span className="spec-tag">WINDOW SERIES =&gt;</span> <span className="spec-val">{series}</span>
              </div>
              <div className="ddupvc-spec-item">
                <span className="spec-tag">GLASS =&gt;</span> <span className="spec-val">{glass}</span>
              </div>
              <div className="ddupvc-spec-item">
                <span className="spec-tag">SASH =&gt;</span> <span className="spec-val">{sash}</span>
              </div>
              <div className="ddupvc-spec-item">
                <span className="spec-tag">MESH =&gt;</span> <span className="spec-val">{mesh}</span>
              </div>
            </div>
          )}

          {/* Windows & Doors Product Items Table (Rendered only when Windows items exist) */}
          {validWindowItems.length > 0 && (
            <table className="ddupvc-table">
              <thead>
                <tr>
                  <th style={{ width: 45, textAlign: "center" }}>S No</th>
                  <th>Window Design</th>
                  <th style={{ width: 85, textAlign: "center" }}>Width</th>
                  <th style={{ width: 85, textAlign: "center" }}>Height</th>
                  <th style={{ width: 95, textAlign: "center" }}>SQ. Ft</th>
                  <th style={{ width: 55, textAlign: "center" }}>QTY</th>
                  <th style={{ width: 110, textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {validWindowItems.map((it, idx) => {
                  const w = Number(it.width) || 0;
                  const h = Number(it.height) || 0;
                  const sq = Number(it.sqFt || (w && h ? (w * h) / 90900 : 0));
                  const amt = Number(it.amount || it.total || (it.quantity * it.unitPrice) || 0);
                  const isLast = idx === validWindowItems.length - 1;

                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", borderBottom: isLast ? "1.5px solid #111827" : "1px solid #111827" }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600, borderBottom: isLast ? "1.5px solid #111827" : "1px solid #111827" }}>{it.description || it.windowType || "3 TRACK WINDOW"}</td>
                      <td style={{ textAlign: "center", borderBottom: isLast ? "1.5px solid #111827" : "1px solid #111827" }}>{w || "-"}</td>
                      <td style={{ textAlign: "center", borderBottom: isLast ? "1.5px solid #111827" : "1px solid #111827" }}>{h || "-"}</td>
                      <td style={{ textAlign: "center", borderBottom: isLast ? "1.5px solid #111827" : "1px solid #111827" }}>{sq.toFixed(2)}</td>
                      <td style={{ textAlign: "center", borderBottom: isLast ? "1.5px solid #111827" : "1px solid #111827" }}>{it.quantity || 1}</td>
                      <td style={{ textAlign: "right", fontWeight: 600, borderBottom: isLast ? "1.5px solid #111827" : "1px solid #111827" }}>
                        ₹ {amt.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="4" className="no-border" style={{ borderTop: "1.5px solid #111827", borderLeft: "none", borderRight: "none", borderBottom: "none" }}></td>
                  <td colSpan="2" className="summary-title-cell" style={{ border: "1px solid #111827" }}>TOTAL SQ. FT</td>
                  <td className="summary-val-cell" style={{ textAlign: "right", border: "1px solid #111827" }}>
                    {totalSqFt.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td colSpan="4" className="no-border" style={{ border: "none" }}></td>
                  <td colSpan="2" className="summary-title-cell" style={{ border: "1px solid #111827" }}>Per Sq. Ft Rate</td>
                  <td className="summary-val-cell" style={{ textAlign: "right", border: "1px solid #111827" }}>
                    ₹ {perSqFtRate.toFixed(2)}
                  </td>
                </tr>
                {validRawMaterials.length > 0 && (
                  <tr>
                    <td colSpan="4" className="no-border" style={{ border: "none" }}></td>
                    <td colSpan="2" className="summary-title-cell" style={{ border: "1px solid #111827", borderBottom: "1.5px solid #111827" }}>Windows Subtotal</td>
                    <td className="summary-val-cell" style={{ textAlign: "right", border: "1px solid #111827", borderBottom: "1.5px solid #111827" }}>
                      ₹ {windowSubtotal.toLocaleString("en-IN")}
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          )}

          {/* Raw Materials & Profiles Table (Exact Same UI / Styling as Windows Table, Rendered only when Raw Materials exist) */}
          {validRawMaterials.length > 0 && (
            <div style={{ marginTop: validWindowItems.length > 0 ? 22 : 10 }}>
              {validWindowItems.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: "#103567", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                    Raw Materials &amp; Profiles (Prominance Catalogue)
                  </span>
                </div>
              )}
              <table className="ddupvc-table">
                <thead>
                  <tr>
                    <th style={{ width: 45, textAlign: "center" }}>S No</th>
                    <th>Raw Material / Profile Description</th>
                    <th style={{ width: 85, textAlign: "center" }}>Meter (m)</th>
                    <th style={{ width: 85, textAlign: "center" }}>SQ. Ft</th>
                    <th style={{ width: 55, textAlign: "center" }}>QTY</th>
                    <th style={{ width: 95, textAlign: "right" }}>Rate (₹)</th>
                    <th style={{ width: 110, textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {validRawMaterials.map((rm, idx) => {
                    const meter = Number(rm.meter) || 0;
                    const sqFt = Number(rm.sqFt) || 0;
                    const qty = Number(rm.quantity) || 1;
                    const rate = Number(rm.rate !== undefined && rm.rate !== null && rm.rate !== "" ? rm.rate : rm.unitPrice) || 0;
                    const amt = Number(rm.total) || (rate * (sqFt > 0 ? sqFt : meter > 0 ? meter : 1) * qty);
                    const isLast = idx === validRawMaterials.length - 1;

                    return (
                      <tr key={idx}>
                        <td style={{ textAlign: "center", borderBottom: isLast ? "1.5px solid #111827" : "1px solid #111827" }}>{idx + 1}</td>
                        <td style={{ fontWeight: 600, borderBottom: isLast ? "1.5px solid #111827" : "1px solid #111827" }}>{rm.description || "Raw Material Profile"}</td>
                        <td style={{ textAlign: "center", borderBottom: isLast ? "1.5px solid #111827" : "1px solid #111827" }}>{meter > 0 ? `${meter.toFixed(2)} m` : "-"}</td>
                        <td style={{ textAlign: "center", borderBottom: isLast ? "1.5px solid #111827" : "1px solid #111827" }}>{sqFt > 0 ? sqFt.toFixed(2) : "-"}</td>
                        <td style={{ textAlign: "center", borderBottom: isLast ? "1.5px solid #111827" : "1px solid #111827" }}>{qty}</td>
                        <td style={{ textAlign: "right", borderBottom: isLast ? "1.5px solid #111827" : "1px solid #111827" }}>₹ {rate.toFixed(2)}</td>
                        <td style={{ textAlign: "right", fontWeight: 600, borderBottom: isLast ? "1.5px solid #111827" : "1px solid #111827" }}>
                          ₹ {amt.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="4" className="no-border" style={{ borderTop: "1.5px solid #111827", borderLeft: "none", borderRight: "none", borderBottom: "none" }}></td>
                    <td colSpan="2" className="summary-title-cell" style={{ border: "1px solid #111827" }}>Total Raw Qty</td>
                    <td className="summary-val-cell" style={{ textAlign: "right", border: "1px solid #111827" }}>
                      {validRawMaterials.reduce((acc, rm) => acc + (Number(rm.quantity) || 1), 0)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan="4" className="no-border" style={{ border: "none" }}></td>
                    <td colSpan="2" className="summary-title-cell" style={{ border: "1px solid #111827", borderBottom: "2px solid #111827" }}>Raw Materials Subtotal</td>
                    <td className="summary-val-cell" style={{ textAlign: "right", border: "1px solid #111827", borderBottom: "2px solid #111827" }}>
                      ₹ {rawSubtotal.toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Accurate Price Calculation & Summary Breakdown Table */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <table style={{ width: "320px", borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {validWindowItems.length > 0 && validRawMaterials.length > 0 && (
                  <>
                    <tr>
                      <td style={{ padding: "4px 8px", color: "#64748b" }}>Windows Subtotal:</td>
                      <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>
                        ₹ {windowSubtotal.toLocaleString("en-IN")}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "4px 8px", color: "#64748b" }}>Raw Materials Subtotal:</td>
                      <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>
                        ₹ {rawSubtotal.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  </>
                )}
                {(discountAmt > 0 || (validWindowItems.length > 0 && validRawMaterials.length > 0)) && (
                  <tr>
                    <td style={{ padding: "4px 8px", color: "#64748b" }}>Gross Subtotal:</td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>
                      ₹ {grossSubtotal.toLocaleString("en-IN")}
                    </td>
                  </tr>
                )}
                {discountAmt > 0 && (
                  <tr>
                    <td style={{ padding: "4px 8px", color: "#dc2626" }}>Discount ({discountPercent}%):</td>
                    <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600, color: "#dc2626" }}>
                      - ₹ {discountAmt.toLocaleString("en-IN")}
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: "4px 8px", color: "#64748b" }}>Taxable Subtotal:</td>
                  <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>
                    ₹ {taxableSubtotal.toLocaleString("en-IN")}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 8px", color: "#64748b" }}>GST (18%):</td>
                  <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>
                    ₹ {taxAmount.toLocaleString("en-IN")}
                  </td>
                </tr>
                <tr className="grand-total-row">
                  <td className="grand-total-label" style={{ padding: "8px 10px", background: "#103567", color: "#fff", fontWeight: 700 }}>
                    Grand Total
                  </td>
                  <td className="grand-total-val" style={{ padding: "8px 10px", textAlign: "right", background: "#103567", color: "#fff", fontWeight: 800, fontSize: 16 }}>
                    ₹ {grandTotal.toLocaleString("en-IN")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Blue Italic Thank You */}
          <div className="ddupvc-thanks-note">
            Thank You for Your Business…..!!!
          </div>

          {/* Dynamic Terms and Conditions */}
          <div className="ddupvc-terms-section">
            <h4 className="ddupvc-terms-heading">Terms and Conditions</h4>
            <ol className="ddupvc-terms-list">
              {termsList.map((t, idx) => (
                <li key={idx}>{t}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* Embedded CSS for Exact Template Layout and Print Styling */}
      <style>{`
        .proforma-template-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.75);
          z-index: 9999;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          overflow-y: auto;
          padding: 30px 15px;
          backdrop-filter: blur(4px);
        }

        .proforma-template-container {
          width: 100%;
          max-width: 860px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .proforma-actions-bar {
          background: #ffffff;
          padding: 12px 20px;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.12);
        }

        .proforma-paper-sheet {
          background: #ffffff;
          padding: 36px 42px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
          border-radius: 4px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #111827;
          line-height: 1.35;
          font-size: 13px;
        }

        /* Header */
        .ddupvc-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .ddupvc-brand {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .ddupvc-logo-box {
          width: 48px;
          height: 48px;
          background: #103567;
          border-radius: 4px;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ddupvc-logo-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3px;
          width: 100%;
          height: 100%;
        }

        .ddupvc-logo-grid span {
          background: #38bdf8;
          border-radius: 1px;
        }

        .ddupvc-company-title {
          font-size: 19px;
          font-weight: 800;
          color: #103567;
          line-height: 1.05;
          margin: 0 0 4px 0;
          text-transform: uppercase;
        }

        .ddupvc-company-name {
          font-size: 13px;
          font-weight: 700;
          color: #103567;
          margin: 0;
        }

        .ddupvc-company-info p {
          margin: 1px 0;
          font-size: 11.5px;
          color: #334155;
        }

        .ddupvc-title-center {
          text-align: center;
          padding-top: 8px;
        }

        .ddupvc-title-center h2 {
          font-size: 20px;
          font-weight: 800;
          color: #103567;
          letter-spacing: 0.5px;
          margin: 0;
          border-bottom: 2px solid #103567;
          padding-bottom: 4px;
        }

        .ddupvc-meta-right {
          text-align: right;
          font-size: 12px;
        }

        .ddupvc-gstin-label {
          font-weight: 800;
          color: #103567;
          font-size: 13px;
        }

        .ddupvc-gstin-val {
          font-weight: 700;
          color: #0f172a;
          font-size: 13px;
          letter-spacing: 0.5px;
        }

        .ddupvc-meta-row {
          margin-top: 4px;
        }

        .ddupvc-meta-row .meta-lbl {
          font-weight: 600;
          color: #475569;
          margin-right: 6px;
        }

        .ddupvc-meta-row .meta-val {
          font-weight: 700;
          color: #0f172a;
        }

        /* Two-Column Info */
        .ddupvc-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 14px;
        }

        .ddupvc-info-box {
          border: 1px solid #103567;
          border-radius: 2px;
          overflow: hidden;
        }

        .ddupvc-box-banner {
          background: #103567;
          color: #ffffff;
          font-weight: 700;
          font-size: 13px;
          padding: 6px 12px;
          text-align: center;
          text-transform: uppercase;
        }

        .ddupvc-box-content {
          padding: 10px 12px;
          min-height: 80px;
        }

        .ddupvc-billto-name {
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 2px 0;
          font-size: 13px;
        }

        .ddupvc-billto-addr {
          color: #334155;
          margin: 0 0 4px 0;
          font-size: 12px;
        }

        .ddupvc-box-content p {
          margin: 2px 0;
          font-size: 12px;
        }

        .b-lbl {
          font-weight: 600;
          color: #475569;
          display: inline-block;
          min-width: 100px;
        }

        .b-val {
          font-weight: 700;
          color: #0f172a;
        }

        /* Window Specs Banner */
        .ddupvc-spec-banner {
          background: #ffffff;
          border: 1px solid #0f172a;
          padding: 6px 12px;
          margin-bottom: 14px;
          display: flex;
          justify-content: space-between;
          font-size: 11px;
        }

        .spec-tag {
          font-weight: 800;
          color: #0f172a;
          margin-right: 4px;
        }

        .spec-val {
          font-weight: 600;
          color: #1e293b;
        }

        /* Items Table */
        .ddupvc-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          margin-bottom: 14px;
          border: 1px solid #111827;
        }

        .ddupvc-table th,
        .ddupvc-table td {
          border: 1px solid #111827;
          padding: 6px 8px;
        }

        .ddupvc-table thead th {
          background: #ffffff;
          color: #111827;
          font-weight: 700;
          text-align: center;
          border: 1px solid #111827;
        }

        .ddupvc-table tbody tr:last-child td {
          border-bottom: 1.5px solid #111827 !important;
        }

        .ddupvc-table tfoot tr:first-child td.no-border {
          border-top: 1.5px solid #111827 !important;
          border-left: none !important;
          border-right: none !important;
          border-bottom: none !important;
          background: transparent !important;
        }

        .ddupvc-table tfoot tr:not(:first-child) td.no-border {
          border: none !important;
          background: transparent !important;
        }

        .summary-title-cell {
          font-weight: 700;
          text-align: right;
          border: 1px solid #111827 !important;
        }

        .summary-val-cell {
          font-weight: 700;
          border: 1px solid #111827 !important;
        }

        .ddupvc-table tfoot tr:last-child td.summary-title-cell,
        .ddupvc-table tfoot tr:last-child td.summary-val-cell {
          border-bottom: 2px solid #111827 !important;
        }

        .grand-total-row td {
          border: 1px solid #103567 !important;
        }

        .grand-total-label {
          background: #103567 !important;
          color: #ffffff !important;
          font-weight: 800;
          font-size: 14px;
          text-align: right;
        }

        .grand-total-val {
          background: #103567 !important;
          color: #ffffff !important;
          font-weight: 800;
          font-size: 15px;
        }

        /* Blue Italic Thank you Note */
        .ddupvc-thanks-note {
          color: #1d4ed8;
          font-style: italic;
          font-weight: 700;
          font-size: 17px;
          margin: 18px 0 14px;
          font-family: "Georgia", serif, -apple-system;
        }

        /* Terms and Conditions */
        .ddupvc-terms-section {
          margin-top: 10px;
        }

        .ddupvc-terms-heading {
          font-weight: 800;
          font-size: 13px;
          color: #111827;
          margin: 0 0 6px 0;
          text-decoration: underline;
        }

        .ddupvc-terms-list {
          margin: 0;
          padding-left: 20px;
          font-size: 12px;
          color: #1f2937;
        }

        .ddupvc-terms-list li {
          margin-bottom: 3px;
        }

        /* Print Media Styles for Crisp 1:1 A4 PDF */
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          .proforma-template-overlay {
            position: static !important;
            padding: 0 !important;
            background: none !important;
          }
          .proforma-paper-sheet,
          .proforma-paper-sheet * {
            visibility: visible;
          }
          .proforma-paper-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px 25px !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}
