import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { CompanySettings } from "../models/index.js";

let transporter = null;
let lastUser = null;
let lastPass = null;

// Address sanitizer to avoid "[object Object]" in emails
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

export function getTransporter() {
  const user = process.env.SMTP_USER || env.smtpUser;
  const pass = process.env.SMTP_PASS || env.smtpPass;
  const host = process.env.SMTP_HOST || env.smtpHost || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || env.smtpPort || "587", 10);

  if (!user || !pass) {
    return null;
  }

  // Recreate transporter if credentials changed
  if (!transporter || lastUser !== user || lastPass !== pass) {
    lastUser = user;
    lastPass = pass;
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  return transporter;
}

export async function sendQuotationEmail({ emailTo, quotation, customer }) {
  try {
    const mailer = getTransporter();
    const user = process.env.SMTP_USER || env.smtpUser;
    if (!mailer || !user) {
      console.warn("⚠️ SMTP credentials not configured in .env (SMTP_USER / SMTP_PASS). Email not dispatched.");
      return { sent: false, reason: "SMTP_NOT_CONFIGURED" };
    }

    const rawItems = Array.isArray(quotation.items) ? quotation.items : [];

    let rawMaterials = Array.isArray(quotation.rawMaterials)
      ? quotation.rawMaterials
      : typeof quotation.rawMaterials === "string"
      ? (() => {
          try {
            return JSON.parse(quotation.rawMaterials) || [];
          } catch (e) {
            return [];
          }
        })()
      : [];

    // Filter valid window items (exclude empty placeholders or unselected designs)
    const validWindowItems = rawItems.filter((it) => {
      const hasName = Boolean((it.description && it.description.trim() && it.description !== "Custom Window") || (it.windowType && it.windowType.trim()));
      const hasDims = (Number(it.width) > 0 && Number(it.height) > 0) || Number(it.sqFt) > 0;
      const hasCost = Number(it.total || it.unitPrice || it.rate) > 0;
      return hasName || (hasDims && hasCost);
    });

    // Filter valid raw materials
    const validRawMaterials = rawMaterials.filter((rm) => {
      const hasDesc = Boolean(rm.description && rm.description.trim());
      const hasMeter = Number(rm.meter) > 0 || Number(rm.sqFt) > 0;
      const hasCost = Number(rm.total || rm.rate || rm.unitPrice) > 0;
      return hasDesc || hasMeter || hasCost;
    });

    // 100% accurate price calculations
    const windowSubtotal = Math.round(
      validWindowItems.reduce((acc, it) => acc + (Number(it.total || (Number(it.unitPrice || it.rate || 0) * (Number(it.quantity) || 1))) || 0), 0)
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
          quotation.discountPercentage !== undefined && quotation.discountPercentage !== null && quotation.discountPercentage !== ""
            ? quotation.discountPercentage
            : quotation.discountValue || 0
        )
      )
    );

    const discountAmt = Math.round(
      quotation.discountAmount !== undefined && quotation.discountAmount !== null && quotation.discountAmount !== ""
        ? Number(quotation.discountAmount)
        : (grossSubtotal * discountPercent) / 100
    );

    const taxableSubtotal = Math.max(0, grossSubtotal - discountAmt);

    const taxAmount =
      quotation.taxAmount !== undefined && quotation.taxAmount !== null && quotation.taxAmount !== ""
        ? Math.round(Number(quotation.taxAmount))
        : Math.round(taxableSubtotal * 0.18);

    const grandTotal =
      quotation.totalAmount !== undefined && quotation.totalAmount !== null && quotation.totalAmount !== ""
        ? Math.round(Number(quotation.totalAmount))
        : taxableSubtotal + taxAmount;

    // Dynamic Client Address, City, State & GST (Sanitized against [object Object])
    const custObj = customer || quotation.customerSnapshot || quotation.customer || {};
    let billing = custObj.billingAddress;
    if (typeof billing === "string") {
      try {
        billing = JSON.parse(billing);
      } catch (e) {
        billing = {};
      }
    }
    const clientName = custObj.companyName || custObj.name || quotation.clientName || "Valued Client";
    const clientAddress = extractAddressString(quotation.clientAddress) || extractAddressString(custObj.address) || extractAddressString(billing?.street) || extractAddressString(billing?.address) || "";
    const clientCity = extractAddressString(quotation.clientCity) || extractAddressString(billing?.city) || extractAddressString(custObj.city) || "Jabalpur";
    const clientState = extractAddressString(quotation.clientState) || extractAddressString(billing?.state) || extractAddressString(custObj.state) || "Madhya Pradesh";
    const clientGst = quotation.clientGst || custObj.gstNumber || custObj.taxNumber || "";
    const clientPhone = custObj.phone || "";
    const clientEmail = custObj.email || emailTo || "";

    // Fetch Dynamic Company Settings from DB
    let companySettings = null;
    try {
      const settingsList = await CompanySettings.find({}).lean();
      if (settingsList && settingsList.length > 0) companySettings = settingsList[0];
    } catch (e) {}

    // Dynamic Company Header & Details
    const companyTitle = companySettings?.companyLegalName || quotation.companyName || companySettings?.displayName || "DD UPVC WINDOWS SYSTEM";
    const companyAddress = companySettings?.address || quotation.companyAddress || "Kudri (Medical College Road), Shahdol, M.P.";
    const companyPhone = companySettings?.phone || quotation.companyPhone || "+91 9826414729";
    const companyGstin = companySettings?.gstin || (quotation.companyGstin && quotation.companyGstin !== "23EVFPG6600A1ZB" ? quotation.companyGstin : "") || quotation.companyGstin || "";

    // Dynamic Bank Details (Fall back to default bank in Settings if not in quotation)
    let defaultSettingsBank = {};
    if (companySettings?.bankDetails) {
      let bList = companySettings.bankDetails;
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

    const bank = (quotation.bankDetails && Object.keys(quotation.bankDetails).length > 0 && quotation.bankDetails.accountNumber)
      ? quotation.bankDetails
      : defaultSettingsBank;

    const acHolder = bank.accountHolder || bank.acHolder || defaultSettingsBank.accountHolder || "DD UPVC WINDOW SYSTEMS";
    const acNumber = bank.accountNumber || bank.acNumber || bank.accountNo || defaultSettingsBank.accountNumber || "44250720832";
    const ifscCode = bank.ifscCode || bank.ifsc || defaultSettingsBank.ifscCode || "SBIN0061553";
    const branch = bank.branch || defaultSettingsBank.branch || "Medical College Shahdol M.P.";
    const bankName = bank.bankName || defaultSettingsBank.bankName || "State Bank of India (SBI)";

    // Dynamic Terms and Conditions
    const rawTerms = quotation.termsAndConditions || "";
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

    // Dynamic Specifications
    const specs = quotation.specifications || {};
    const series = specs.series || quotation.profileSeries || "INVENTA";
    const glass = specs.glass || quotation.glassType || "10 MM CLEAR TUFF GLASS";
    const sash = specs.sash || quotation.sash || "79MM SLIDING SASH";
    const mesh = specs.mesh || quotation.mesh || "SS MESH 304G NATURAL";

    const itemsHtml = validWindowItems
      .map(
        (it, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 8px; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px 8px; font-weight: 600; color: #0f172a;">${it.description || it.windowType || "Window Unit"}</td>
        <td style="padding: 10px 8px; text-align: center;">${it.width || "-"}</td>
        <td style="padding: 10px 8px; text-align: center;">${it.height || "-"}</td>
        <td style="padding: 10px 8px; text-align: center; font-weight: 600;">${Number(it.sqFt || 0).toFixed(2)}</td>
        <td style="padding: 10px 8px; text-align: center;">${it.quantity || 1}</td>
        <td style="padding: 10px 8px; text-align: right; white-space: nowrap; font-weight: 600;">₹${Number(it.unitPrice || it.rate || 0).toLocaleString("en-IN")}</td>
        <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: #103567; white-space: nowrap;">₹${Number(it.total || 0).toLocaleString("en-IN")}</td>
      </tr>
    `
      )
      .join("");

    const rawMaterialsHtml = validRawMaterials
      .map(
        (rm, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 8px; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px 8px; font-weight: 600; color: #0f172a;">${rm.description || "Raw Material Profile"}</td>
        <td style="padding: 10px 8px; text-align: center; font-weight: 600;">${Number(rm.meter || 0) > 0 ? `${Number(rm.meter).toFixed(2)} m` : "-"}</td>
        <td style="padding: 10px 8px; text-align: center;">${Number(rm.sqFt || 0) > 0 ? Number(rm.sqFt).toFixed(2) : "-"}</td>
        <td style="padding: 10px 8px; text-align: center;">${rm.quantity || 1}</td>
        <td style="padding: 10px 8px; text-align: right; white-space: nowrap;">₹${Number(rm.rate || rm.unitPrice || 0).toLocaleString("en-IN")}</td>
        <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: #103567; white-space: nowrap;">₹${Number(rm.total || 0).toLocaleString("en-IN")}</td>
      </tr>
    `
      )
      .join("");

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Quotation ${quotation.quotationNumber || ""}</title>
      <style>
        /* Default Desktop Styling */
        .email-card-container {
          max-width: 720px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }
        .table-responsive-wrapper {
          width: 100%;
          overflow: visible;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .mobile-swipe-notice {
          display: none !important;
        }

        /* Mobile View Only - Horizontal Scroll for Rate & Amount Columns */
        @media only screen and (max-width: 600px) {
          .email-card-container {
            width: 100% !important;
            border-radius: 4px !important;
          }
          .table-responsive-wrapper {
            width: 100% !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            display: block !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 6px !important;
            margin-top: 8px !important;
            margin-bottom: 8px !important;
          }
          .items-table {
            min-width: 620px !important;
            width: 620px !important;
          }
          .mobile-swipe-notice {
            display: block !important;
            background: #eff6ff !important;
            color: #1d4ed8 !important;
            border: 1px dashed #93c5fd !important;
            padding: 6px 10px !important;
            border-radius: 4px !important;
            font-size: 11px !important;
            font-weight: 600 !important;
            text-align: right !important;
            margin: 10px 0 4px !important;
          }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 12px 6px; background-color: #f1f5f9; color: #1e293b;">
      <div class="email-card-container">
        <!-- Header -->
        <div style="background: #103567; color: #ffffff; padding: 22px 18px; text-align: center;">
          <h1 style="margin: 0; font-size: 23px; letter-spacing: 1px; font-weight: 800;">${companyTitle}</h1>
          <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">${companyAddress} | Phone: ${companyPhone}</p>
          <div style="margin-top: 10px; display: inline-block; background: #38bdf8; color: #0f172a; padding: 4px 14px; border-radius: 4px; font-weight: 700; font-size: 13px;">
            QUOTATION: ${quotation.quotationNumber || "QT-2026"}
          </div>
        </div>

        <div style="padding: 20px 18px;">
          <!-- Two Column Bill To & Quotation Meta -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tr>
              <td style="vertical-align: top; width: 60%; padding-right: 12px;">
                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">BILL TO:</p>
                <h3 style="margin: 2px 0 4px; color: #0f172a; font-size: 16px;">${clientName}</h3>
                ${clientAddress ? `<p style="margin: 0 0 2px; font-size: 13px; color: #475569;">${clientAddress}</p>` : ""}
                <p style="margin: 0 0 2px; font-size: 13px; color: #475569;">${clientCity}, ${clientState}</p>
                ${clientPhone ? `<p style="margin: 0 0 2px; font-size: 12px; color: #475569;">Phone: ${clientPhone}</p>` : ""}
                ${clientEmail ? `<p style="margin: 0 0 2px; font-size: 12px; color: #475569;">Email: ${clientEmail}</p>` : ""}
                ${clientGst ? `<p style="margin: 2px 0 0; font-size: 12px; color: #103567; font-weight: 600;">GSTIN: ${clientGst}</p>` : ""}
                ${quotation.projectName ? `<p style="margin: 4px 0 0; font-size: 13px; color: #103567;">Project: <b>${quotation.projectName}</b></p>` : ""}
              </td>
              <td style="vertical-align: top; width: 40%; text-align: right;">
                <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">DATE:</p>
                <p style="margin: 2px 0 4px; font-size: 14px; font-weight: bold; color: #0f172a;">${new Date().toLocaleDateString("en-IN")}</p>
                <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">GSTIN NO: <b style="color: #0f172a;">${companyGstin}</b></p>
              </td>
            </tr>
          </table>

          ${
            validWindowItems.length > 0
              ? `
          <!-- Specification Highlight Banner -->
          <div style="background: #f1f5f9; border-left: 4px solid #103567; padding: 10px 14px; margin-bottom: 14px; font-size: 12px; border-radius: 4px;">
            <span><b>SERIES:</b> ${series}</span> &nbsp;|&nbsp;
            <span><b>GLASS:</b> ${glass}</span> &nbsp;|&nbsp;
            <span><b>SASH:</b> ${sash}</span> &nbsp;|&nbsp;
            <span><b>MESH:</b> ${mesh}</span>
          </div>

          <!-- Mobile Horizontal Swipe Notice (Visible on mobile screen only) -->
          <div class="mobile-swipe-notice">
            👉 Slide table horizontally to view Rate &amp; Amount columns ➔
          </div>

          <!-- Line Items Table with Horizontal Scroll Wrapper for Mobile -->
          <div class="table-responsive-wrapper">
            <table class="items-table">
              <thead>
                <tr style="background: #103567; color: #ffffff;">
                  <th style="padding: 9px 8px; text-align: center; width: 40px;">S No</th>
                  <th style="padding: 9px 8px; text-align: left;">Window Design</th>
                  <th style="padding: 9px 8px; text-align: center; width: 70px;">Width</th>
                  <th style="padding: 9px 8px; text-align: center; width: 70px;">Height</th>
                  <th style="padding: 9px 8px; text-align: center; width: 70px;">Sq. Ft</th>
                  <th style="padding: 9px 8px; text-align: center; width: 45px;">Qty</th>
                  <th style="padding: 9px 8px; text-align: right; width: 95px; white-space: nowrap;">Rate</th>
                  <th style="padding: 9px 8px; text-align: right; width: 110px; white-space: nowrap;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
              <tfoot>
                <tr style="background: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1;">
                  <td colspan="7" style="padding: 10px 8px; text-align: right; font-size: 13px;">${validRawMaterials.length > 0 ? "WINDOWS SUBTOTAL:" : "SUBTOTAL:"}</td>
                  <td style="padding: 10px 8px; text-align: right; font-size: 14px; color: #103567; white-space: nowrap;">₹${windowSubtotal.toLocaleString("en-IN")}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          `
              : ""
          }

          ${
            validRawMaterials.length > 0
              ? `
          ${validWindowItems.length > 0 ? `
          <div style="margin-top: 20px; margin-bottom: 6px;">
            <h4 style="margin: 0 0 6px; font-size: 13px; color: #103567; text-transform: uppercase;">Raw Materials &amp; Profiles (Prominance):</h4>
          </div>
          ` : `
          <!-- Mobile Horizontal Swipe Notice for Raw Materials -->
          <div class="mobile-swipe-notice">
            👉 Slide table horizontally to view Rate &amp; Amount columns ➔
          </div>
          `}
          <div class="table-responsive-wrapper">
            <table class="items-table">
              <thead>
                <tr style="background: #103567; color: #ffffff;">
                  <th style="padding: 9px 8px; text-align: center; width: 40px;">S No</th>
                  <th style="padding: 9px 8px; text-align: left;">Raw Material / Profile Description</th>
                  <th style="padding: 9px 8px; text-align: center; width: 85px;">Meter</th>
                  <th style="padding: 9px 8px; text-align: center; width: 75px;">Sq. Ft</th>
                  <th style="padding: 9px 8px; text-align: center; width: 45px;">Qty</th>
                  <th style="padding: 9px 8px; text-align: right; width: 95px; white-space: nowrap;">Rate</th>
                  <th style="padding: 9px 8px; text-align: right; width: 105px; white-space: nowrap;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${rawMaterialsHtml}
              </tbody>
              <tfoot>
                <tr style="background: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1;">
                  <td colspan="6" style="padding: 10px 8px; text-align: right; font-size: 13px;">RAW MATERIALS SUBTOTAL:</td>
                  <td style="padding: 10px 8px; text-align: right; font-size: 14px; color: #103567; white-space: nowrap;">₹${rawSubtotal.toLocaleString("en-IN")}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          `
              : ""
          }

          <!-- Accurate Cost Summary Totals Box -->
          <div style="display: flex; justify-content: flex-end; margin-top: 14px;">
            <table style="width: 300px; border-collapse: collapse; font-size: 13px; margin-left: auto;">
              ${
                validWindowItems.length > 0 && validRawMaterials.length > 0
                  ? `
              <tr>
                <td style="padding: 4px 6px; color: #64748b;">Windows Subtotal:</td>
                <td style="padding: 4px 6px; text-align: right; font-weight: 600;">₹${windowSubtotal.toLocaleString("en-IN")}</td>
              </tr>
              <tr>
                <td style="padding: 4px 6px; color: #64748b;">Raw Materials Subtotal:</td>
                <td style="padding: 4px 6px; text-align: right; font-weight: 600;">₹${rawSubtotal.toLocaleString("en-IN")}</td>
              </tr>
              `
                  : ""
              }
              ${
                discountAmt > 0 || (validWindowItems.length > 0 && validRawMaterials.length > 0)
                  ? `
              <tr>
                <td style="padding: 4px 6px; color: #64748b;">Gross Subtotal:</td>
                <td style="padding: 4px 6px; text-align: right; font-weight: 600;">₹${grossSubtotal.toLocaleString("en-IN")}</td>
              </tr>
              `
                  : ""
              }
              ${
                discountAmt > 0
                  ? `
              <tr>
                <td style="padding: 4px 6px; color: #dc2626;">Discount (${discountPercent}%):</td>
                <td style="padding: 4px 6px; text-align: right; font-weight: 600; color: #dc2626;">- ₹${discountAmt.toLocaleString("en-IN")}</td>
              </tr>
              `
                  : ""
              }
              <tr>
                <td style="padding: 4px 6px; color: #64748b;">Taxable Subtotal:</td>
                <td style="padding: 4px 6px; text-align: right; font-weight: 600;">₹${taxableSubtotal.toLocaleString("en-IN")}</td>
              </tr>
              <tr>
                <td style="padding: 4px 6px; color: #64748b;">GST (18%):</td>
                <td style="padding: 4px 6px; text-align: right; font-weight: 600;">₹${taxAmount.toLocaleString("en-IN")}</td>
              </tr>
              <tr style="background: #103567; color: #ffffff;">
                <td style="padding: 8px 10px; font-weight: bold;">GRAND TOTAL:</td>
                <td style="padding: 8px 10px; text-align: right; font-weight: bold; font-size: 15px;">₹${grandTotal.toLocaleString("en-IN")}</td>
              </tr>
            </table>
          </div>

          <!-- Dynamic Bank Details Box -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin-top: 18px; margin-bottom: 16px;">
            <h4 style="margin: 0 0 8px; color: #103567; font-size: 13px; text-transform: uppercase;">Bank Details for Payment:</h4>
            <p style="margin: 2px 0; font-size: 12px;"><span style="color: #64748b;">Bank Name:</span> <b>${bankName}</b></p>
            <p style="margin: 2px 0; font-size: 12px;"><span style="color: #64748b;">A/C Holder:</span> <b>${acHolder}</b></p>
            <p style="margin: 2px 0; font-size: 12px;"><span style="color: #64748b;">Account Number:</span> <b>${acNumber}</b></p>
            <p style="margin: 2px 0; font-size: 12px;"><span style="color: #64748b;">IFSC Code:</span> <b>${ifscCode}</b></p>
            <p style="margin: 2px 0; font-size: 12px;"><span style="color: #64748b;">Branch:</span> <b>${branch}</b></p>
          </div>

          <!-- Dynamic Terms and Conditions in Email -->
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
            <h4 style="margin: 0 0 8px; color: #103567; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Terms and Conditions:</h4>
            <ol style="margin: 0; padding-left: 20px; font-size: 12px; color: #334155; line-height: 1.6;">
              ${termsList.map((t) => `<li style="margin-bottom: 4px;">${t}</li>`).join("")}
            </ol>
          </div>

          <div style="margin-top: 24px; text-align: center; color: #103567; font-style: italic; font-weight: 600; font-size: 15px;">
            Thank You for Your Business…..!!!
          </div>
        </div>
      </div>
    </body>
    </html>
    `;

    const info = await mailer.sendMail({
      from: `"DD UPVC WINDOWS" <${user}>`,
      to: emailTo,
      subject: `Quotation ${quotation.quotationNumber || ""} - DD UPVC WINDOWS SYSTEM`,
      html,
    });

    console.log(`✉️ Quotation email dispatched to ${emailTo} (MessageId: ${info.messageId})`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error("❌ Failed to send quotation email:", err.message);
    return { sent: false, error: err.message };
  }
}
