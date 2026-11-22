import React, { useState, useEffect } from "react";
import { App } from "antd";
import dayjs from "dayjs";
import { quotationAPI, customerAPI, productAPI, settingsAPI } from "../services/api";
import ProformaInvoiceTemplate from "../components/ProformaInvoiceTemplate";
import { UPVC_WINDOW_DESIGNS, WINDOW_DESIGN_CATEGORIES } from "../data/windowDesigns";

function statusPill(s) {
  const x = (s || "").toLowerCase();
  let c = /approved|accepted/.test(x)
    ? "green"
    : /rejected|expired/.test(x)
    ? "red"
    : /sent/.test(x)
    ? "blue"
    : "amber";
  return <span className={`pill ${c}`}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : "Draft"}</span>;
}

// Window series options restricted strictly to Inventa and Optima
const SERIES_OPTIONS = ["INVENTA", "OPTIMA"];

// Address / String Sanitizer to avoid "[object Object]" in UI
export function extractAddressString(addr) {
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

export function extractCityString(cust, billing) {
  if (billing && typeof billing === "object" && billing.city) return billing.city;
  if (cust?.city) return cust.city;
  if (cust?.address && typeof cust.address === "object" && cust.address.city) return cust.address.city;
  if (typeof cust?.address === "string" && cust.address.startsWith("{")) {
    try {
      const p = JSON.parse(cust.address);
      if (p.city) return p.city;
    } catch (e) {}
  }
  return "";
}

export function extractStateString(cust, billing) {
  if (billing && typeof billing === "object" && billing.state) return billing.state;
  if (cust?.state) return cust.state;
  if (cust?.address && typeof cust.address === "object" && cust.address.state) return cust.address.state;
  if (typeof cust?.address === "string" && cust.address.startsWith("{")) {
    try {
      const p = JSON.parse(cust.address);
      if (p.state) return p.state;
    } catch (e) {}
  }
  return "";
}

export default function Quotations() {
  const { message, modal } = App.useApp();
  const [quotations, setQuotations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");

  // In-Page View Mode: "list" (register table) or "form" (dedicated full-page editor/viewer - NO MODAL OVERLAY)
  const [viewMode, setViewMode] = useState("list");
  const [editingQuotation, setEditingQuotation] = useState(null);
  const [previewQuotation, setPreviewQuotation] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [companySettings, setCompanySettings] = useState(null);

  // Filter for Section 3: Window & Door designs category filter
  const [windowCategoryFilter, setWindowCategoryFilter] = useState("All Categories");

  // Filter for Section 4: Raw Material category filter
  const [rawCategoryFilter, setRawCategoryFilter] = useState("All");

  const [form, setForm] = useState({
    customerId: "",
    projectName: "",
    clientAddress: "",
    clientCity: "",
    clientState: "",
    clientGst: "",
    companyGstin: "",
    bankDetails: {
      accountHolder: "DD UPVC WINDOW SYSTEMS",
      accountNumber: "44250720832",
      ifscCode: "SBIN0061553",
      branch: "Medical College Shahdol M.P.",
      bankName: "State Bank of India (SBI)",
    },
    validUntil: dayjs().add(30, "day").format("YYYY-MM-DD"),
    status: "draft",
    profileSeries: "INVENTA",
    glassType: "",
    hardware: "",
    installationIncluded: true,
    discountPercentage: "",
    termsAndConditions:
      "1. Installation work will be carried out on FOR basis as per finalized scope.\n2. Total project duration shall be 25 to 35 working days, starting after advance payment.\n3. 50% advance, 30% after dispatch (before unloading), and 20% after installation is mandatory.\n4. All payments must be cleared as per schedule to ensure smooth and timely execution.",
    lineItems: [
      {
        productId: "",
        productCode: "",
        windowType: "",
        width: "",
        height: "",
        sqFt: "",
        quantity: 1,
        rate: "",
        total: 0,
      },
    ],
    rawMaterials: [],
  });

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const res = await quotationAPI.list({ limit: 100 });
      setQuotations(res.data?.quotations || res.data?.data?.quotations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await customerAPI.list({ limit: 100 });
      setCustomers(res.data?.customers || res.data?.data?.customers || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await productAPI.list({ limit: 300 });
      setProducts(res.data?.products || []);
    } catch (err) {
      console.error("Failed to fetch products catalogue", err);
    }
  };

  const fetchSettings = async () => {
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
        const parsedBanks = Array.isArray(banks) ? banks : [];
        setCompanySettings({
          ...s,
          bankDetails: parsedBanks,
        });
        const defB = parsedBanks.find((b) => b.isDefault) || parsedBanks[0];
        setForm((prev) => ({
          ...prev,
          companyGstin: prev.companyGstin && prev.companyGstin !== "23EVFPG6600A1ZB" ? prev.companyGstin : (s.gstin || ""),
          bankDetails: defB && (!prev.bankDetails?.accountNumber || prev.bankDetails.accountNumber === "44250720832") ? {
            accountHolder: defB.accountHolder,
            accountNumber: defB.accountNumber,
            ifscCode: defB.ifscCode,
            branch: defB.branch,
            bankName: defB.bankName,
          } : prev.bankDetails,
        }));
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  };

  useEffect(() => {
    fetchQuotations();
    fetchCustomers();
    fetchProducts();
    fetchSettings();
  }, []);

  const handleCustomerSelect = (custId) => {
    if (!custId) {
      setForm((prev) => ({
        ...prev,
        customerId: "",
        clientAddress: "",
        clientCity: "",
        clientState: "",
        clientGst: "",
      }));
      return;
    }
    const cust = customers.find((c) => c._id === custId || c.id === custId);
    let billing = cust?.billingAddress;
    if (typeof billing === "string") {
      try {
        billing = JSON.parse(billing);
      } catch (e) {
        billing = {};
      }
    }

    const street = extractAddressString(cust?.address) || extractAddressString(billing?.street) || extractAddressString(billing?.address) || "";
    const city = extractCityString(cust, billing);
    const state = extractStateString(cust, billing);

    setForm((prev) => ({
      ...prev,
      customerId: custId,
      clientAddress: street,
      clientCity: city,
      clientState: state,
      clientGst: cust?.gstNumber || cust?.taxNumber || "",
    }));
  };

  const handleOpenNew = () => {
    setEditingQuotation(null);
    const defaultBank =
      companySettings?.bankDetails && Array.isArray(companySettings.bankDetails)
        ? companySettings.bankDetails.find((b) => b.isDefault) || companySettings.bankDetails[0] || {}
        : {};

    setForm({
      customerId: "",
      projectName: "",
      clientAddress: "",
      clientCity: "",
      clientState: "",
      clientGst: "",
      companyGstin: companySettings?.gstin || "",
      bankDetails: {
        accountHolder: defaultBank.accountHolder || "DD UPVC WINDOW SYSTEMS",
        accountNumber: defaultBank.accountNumber || "44250720832",
        ifscCode: defaultBank.ifscCode || "SBIN0061553",
        branch: defaultBank.branch || "Medical College Shahdol M.P.",
        bankName: defaultBank.bankName || "State Bank of India (SBI)",
      },
      validUntil: dayjs().add(30, "day").format("YYYY-MM-DD"),
      status: "draft",
      profileSeries: "INVENTA",
      glassType: "",
      hardware: "",
      installationIncluded: true,
      discountPercentage: "",
      termsAndConditions:
        "1. Installation work will be carried out on FOR basis as per finalized scope.\n2. Total project duration shall be 25 to 35 working days, starting after advance payment.\n3. 50% advance, 30% after dispatch (before unloading), and 20% after installation is mandatory.\n4. All payments must be cleared as per schedule to ensure smooth and timely execution.",
      lineItems: [
        {
          productId: "",
          productCode: "",
          windowType: "",
          width: "",
          height: "",
          sqFt: "",
          quantity: 1,
          rate: "",
          total: 0,
        },
      ],
      rawMaterials: [],
    });
    setViewMode("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleViewOrEdit = (quote) => {
    setEditingQuotation(quote);

    const rawItems = Array.isArray(quote.items) ? quote.items : Array.isArray(quote.lineItems) ? quote.lineItems : [];
    const mappedLines =
      rawItems.length > 0
        ? rawItems.map((it) => {
            let w = it.width !== undefined && it.width !== null ? it.width : "";
            let h = it.height !== undefined && it.height !== null ? it.height : "";
            let type = it.description || it.windowType || "";

            const match = (it.description || "").match(/\((\d+)x(\d+)mm\)/);
            if (match && (!w || !h)) {
              w = Number(match[1]) || 1200;
              h = Number(match[2]) || 1200;
              type = it.description.replace(/\s*\(\d+x\d+mm\)/, "");
            }

            const numW = Number(w) || 0;
            const numH = Number(h) || 0;
            const computedSqFt = numW > 0 && numH > 0 ? Math.round(((numW * numH) / 90900) * 100) / 100 : (it.sqFt !== undefined ? it.sqFt : "");
            const rate = it.unitPrice !== undefined ? it.unitPrice : it.rate !== undefined ? it.rate : "";
            const qty = Number(it.quantity) || 1;
            const total = Number(computedSqFt) > 0 && Number(rate) > 0
              ? Math.round(Number(computedSqFt) * Number(rate) * qty * 10) / 10
              : Number(it.total || (Number(rate) * qty) || 0);

            return {
              productId: it.productId || "",
              productCode: it.productCode || "",
              windowType: type,
              width: w,
              height: h,
              sqFt: computedSqFt,
              quantity: qty,
              rate,
              total,
            };
          })
        : [
            {
              productId: "",
              productCode: "",
              windowType: "",
              width: "",
              height: "",
              sqFt: "",
              quantity: 1,
              rate: "",
              total: 0,
            },
          ];

    // Mapped Raw Materials
    let mappedRaw = [];
    if (Array.isArray(quote.rawMaterials)) {
      mappedRaw = quote.rawMaterials;
    } else if (typeof quote.rawMaterials === "string") {
      try {
        mappedRaw = JSON.parse(quote.rawMaterials) || [];
      } catch (e) {
        mappedRaw = [];
      }
    }

    const custId = quote.customer?._id || quote.customer || "";
    let billing = quote.customerSnapshot?.billingAddress || quote.customer?.billingAddress;
    if (typeof billing === "string") {
      try {
        billing = JSON.parse(billing);
      } catch (e) {
        billing = {};
      }
    }

    const bank = quote.bankDetails || {
      accountHolder: "DD UPVC WINDOW SYSTEMS",
      accountNumber: "44250720832",
      ifscCode: "SBIN0061553",
      branch: "Medical College Shahdol M.P.",
      bankName: "State Bank of India (SBI)",
    };

    // Series fallback strictly to INVENTA or OPTIMA
    const seriesVal = SERIES_OPTIONS.includes((quote.profileSeries || "").toUpperCase())
      ? (quote.profileSeries || "").toUpperCase()
      : "INVENTA";

    const street = extractAddressString(quote.clientAddress) || extractAddressString(quote.customerSnapshot?.address) || extractAddressString(billing?.street) || extractAddressString(billing?.address) || "";
    const city = quote.clientCity || extractCityString(quote.customerSnapshot || quote.customer, billing);
    const state = quote.clientState || extractStateString(quote.customerSnapshot || quote.customer, billing);

    setForm({
      customerId: custId,
      projectName: quote.projectName || "",
      clientAddress: street,
      clientCity: city,
      clientState: state,
      clientGst: quote.clientGst || quote.customerSnapshot?.gstNumber || quote.customer?.gstNumber || "",
      companyGstin: (quote.companyGstin && quote.companyGstin !== "23EVFPG6600A1ZB") ? quote.companyGstin : (companySettings?.gstin || quote.companyGstin || ""),
      bankDetails: bank,
      validUntil: quote.validUntil ? dayjs(quote.validUntil).format("YYYY-MM-DD") : dayjs().add(30, "day").format("YYYY-MM-DD"),
      status: quote.status || "draft",
      profileSeries: seriesVal,
      glassType: quote.glassType || "",
      hardware: quote.hardware || "",
      installationIncluded: quote.installationIncluded !== undefined ? quote.installationIncluded : true,
      discountPercentage: quote.discountPercentage !== undefined && quote.discountPercentage !== null ? quote.discountPercentage : quote.discountValue !== undefined ? quote.discountValue : "",
      termsAndConditions:
        quote.termsAndConditions ||
        "1. Installation work will be carried out on FOR basis as per finalized scope.\n2. Total project duration shall be 25 to 35 working days, starting after advance payment.\n3. 50% advance, 30% after dispatch (before unloading), and 20% after installation is mandatory.\n4. All payments must be cleared as per schedule to ensure smooth and timely execution.",
      lineItems: mappedLines,
      rawMaterials: mappedRaw.map((rm) => ({
        productId: rm.productId || "",
        productCode: rm.productCode || "",
        description: rm.description || "",
        meter: rm.meter !== undefined ? rm.meter : "",
        sqFt: rm.sqFt !== undefined ? rm.sqFt : "",
        quantity: rm.quantity !== undefined ? rm.quantity : 1,
        rate: rm.rate !== undefined ? rm.rate : rm.unitPrice !== undefined ? rm.unitPrice : "",
        total: Number(rm.total) || 0,
      })),
    });
    setViewMode("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Handlers for Section 3: Window & Door Measurement Grid ───────────────────
  const handleWindowSelect = (idx, designId) => {
    const updated = [...form.lineItems];
    const item = { ...updated[idx] };

    if (designId === "OTHER") {
      item.productId = "OTHER";
      item.productCode = "CUSTOM";
      item.windowType = "";
      updated[idx] = item;
      setForm({ ...form, lineItems: updated });
      return;
    }

    if (!designId) {
      item.productId = "";
      item.productCode = "";
      item.windowType = "";
      item.rate = "";
      item.total = 0;
      updated[idx] = item;
      setForm({ ...form, lineItems: updated });
      return;
    }

    const design = UPVC_WINDOW_DESIGNS.find((d) => d.id === designId);
    if (!design) return;

    item.productId = design.id;
    item.productCode = design.id;
    item.windowType = design.name;
    item.rate = Number(design.defaultRate) || 690;

    const w = Number(item.width) || 0;
    const h = Number(item.height) || 0;
    if (w > 0 && h > 0) {
      item.sqFt = Math.round(((w * h) / 90900) * 100) / 100;
      item.total = Math.round(item.sqFt * Number(item.rate) * (Number(item.quantity) || 1) * 10) / 10;
    } else {
      item.total = Math.round(Number(item.rate) * (Number(item.quantity) || 1));
    }

    updated[idx] = item;
    setForm({ ...form, lineItems: updated });
  };

  const handleLineChange = (idx, field, val) => {
    const updated = [...form.lineItems];
    const item = { ...updated[idx], [field]: val };

    const w = Number(field === "width" ? val : item.width) || 0;
    const h = Number(field === "height" ? val : item.height) || 0;
    const rate = Number(field === "rate" ? val : item.rate) || 0;
    const qty = Number(field === "quantity" ? val : item.quantity) || 1;

    if (field === "width" || field === "height") {
      if (w > 0 && h > 0) {
        item.sqFt = Math.round(((w * h) / 90900) * 100) / 100;
      }
    }

    const sqFt = Number(field === "sqFt" ? val : item.sqFt) || 0;

    if (sqFt > 0) {
      item.total = Math.round(sqFt * rate * qty * 10) / 10;
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
          productCode: "",
          windowType: "",
          width: "",
          height: "",
          sqFt: "",
          quantity: 1,
          rate: "",
          total: 0,
        },
      ],
    });
  };

  const handleRemoveLine = (idx) => {
    if (form.lineItems.length === 1 && (!form.rawMaterials || form.rawMaterials.length === 0)) {
      message.warning("Quotation must have at least one line item or raw material.");
      return;
    }
    setForm({
      ...form,
      lineItems: form.lineItems.filter((_, i) => i !== idx),
    });
  };

  // ── Handlers for Section 4: Raw Materials Grid (Meter, Sq. Ft & Qty) ──────────
  const handleRawMaterialSelect = (idx, prodId) => {
    const updated = [...form.rawMaterials];
    const item = { ...updated[idx] };

    if (prodId === "OTHER") {
      item.productId = "OTHER";
      item.productCode = "CUSTOM";
      item.description = "";
      updated[idx] = item;
      setForm({ ...form, rawMaterials: updated });
      return;
    }

    if (!prodId) {
      item.productId = "";
      item.productCode = "";
      item.description = "";
      item.meter = "";
      item.sqFt = "";
      item.rate = "";
      item.total = 0;
      updated[idx] = item;
      setForm({ ...form, rawMaterials: updated });
      return;
    }

    const prod = products.find((p) => (p._id || p.id) === prodId);
    if (!prod) return;

    item.productId = prod._id || prod.id;
    item.productCode = prod.productCode || "";
    item.description = `${prod.name} ${prod.productCode ? `(${prod.productCode})` : ""}`;

    // Auto-populate price per meter
    const rate = Number(prod.pricePerMeter) > 0 ? Number(prod.pricePerMeter) : Number(prod.pricePerPiece) || 0;
    item.rate = rate;
    const meter = Number(item.meter) > 0 ? Number(item.meter) : Number(prod.profileLength) || 5.8;
    item.meter = meter;
    const qty = Number(item.quantity) || 1;
    const sqFt = Number(item.sqFt) || 0;

    let total = 0;
    if (sqFt > 0) {
      total = Math.round(sqFt * rate * qty * 10) / 10;
    } else if (meter > 0) {
      total = Math.round(meter * rate * qty * 10) / 10;
    } else {
      total = Math.round(rate * qty * 10) / 10;
    }

    item.total = total;
    updated[idx] = item;
    setForm({ ...form, rawMaterials: updated });
  };

  const handleRawMaterialChange = (idx, field, val) => {
    const updated = [...form.rawMaterials];
    const item = { ...updated[idx], [field]: val };
    const meter = Number(field === "meter" ? val : item.meter) || 0;
    const sqFt = Number(field === "sqFt" ? val : item.sqFt) || 0;
    const qty = Number(field === "quantity" ? val : item.quantity) || 1;
    const rate = Number(field === "rate" ? val : item.rate) || 0;

    let total = 0;
    if (sqFt > 0) {
      total = Math.round(sqFt * rate * qty * 10) / 10;
    } else if (meter > 0) {
      total = Math.round(meter * rate * qty * 10) / 10;
    } else {
      total = Math.round(rate * qty * 10) / 10;
    }

    item.total = total;
    updated[idx] = item;
    setForm({ ...form, rawMaterials: updated });
  };

  const handleAddRawMaterial = () => {
    setForm({
      ...form,
      rawMaterials: [
        ...(form.rawMaterials || []),
        {
          productId: "",
          productCode: "",
          description: "",
          meter: "",
          sqFt: "",
          quantity: 1,
          rate: "",
          total: 0,
        },
      ],
    });
  };

  const handleRemoveRawMaterial = (idx) => {
    setForm({
      ...form,
      rawMaterials: (form.rawMaterials || []).filter((_, i) => i !== idx),
    });
  };

  // ── Dynamic Pricing Engine with Optional Discount ────────────────────────────
  const validWindowLines = form.lineItems.filter(
    (it) => (it.windowType && it.windowType.trim() && it.windowType !== "Custom Window") ||
            Number(it.total) > 0 ||
            Number(it.rate) > 0 ||
            (Number(it.width) > 0 && Number(it.height) > 0)
  );

  const validRawLines = (form.rawMaterials || []).filter(
    (rm) => (rm.description && rm.description.trim()) ||
            Number(rm.total) > 0 ||
            Number(rm.rate) > 0 ||
            Number(rm.meter) > 0 ||
            Number(rm.sqFt) > 0
  );

  const windowSubtotal = Math.round(validWindowLines.reduce((acc, it) => acc + (Number(it.total) || 0), 0));
  const rawMaterialSubtotal = Math.round(validRawLines.reduce((acc, it) => acc + (Number(it.total) || 0), 0));
  const grossSubtotal = windowSubtotal + rawMaterialSubtotal;

  const discountPercent = Math.min(100, Math.max(0, Number(form.discountPercentage) || 0));
  const discountAmount = Math.round((grossSubtotal * discountPercent) / 100);
  const taxableSubtotal = grossSubtotal - discountAmount;
  const tax = Math.round(taxableSubtotal * 0.18);
  const totalAmount = taxableSubtotal + tax;

  const totalSqFt = validWindowLines.reduce(
    (acc, it) => acc + (Number(it.sqFt) || 0) * (Number(it.quantity) || 1),
    0
  );
  const totalRawMeters = validRawLines.reduce((acc, it) => acc + (Number(it.meter) || 0), 0);
  const totalRawSqFt = validRawLines.reduce(
    (acc, it) => acc + (Number(it.sqFt) || 0) * (Number(it.quantity) || 1),
    0
  );
  const totalRawQty = validRawLines.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);

  // Distinct categories for the 34 Raw Materials catalogue
  const distinctRawCategories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

  const handleSaveQuotation = async () => {
    if (!form.customerId) {
      message.error("Please select a customer.");
      return;
    }

    if (validWindowLines.length === 0 && validRawLines.length === 0) {
      message.error("Please add at least one window item or raw material before saving.");
      return;
    }

    try {
      const payload = {
        customer: form.customerId,
        projectName: form.projectName,
        clientAddress: extractAddressString(form.clientAddress),
        clientCity: form.clientCity,
        clientState: form.clientState,
        clientGst: form.clientGst,
        companyGstin: form.companyGstin,
        bankDetails: form.bankDetails,
        validUntil: form.validUntil,
        status: form.status,
        profileSeries: form.profileSeries,
        glassType: form.glassType,
        hardware: form.hardware,
        installationIncluded: form.installationIncluded,
        termsAndConditions: form.termsAndConditions,
        specifications: {
          series: form.profileSeries || "INVENTA",
          glass: form.glassType || "10 MM CLEAR TUFF GLASS",
          hardware: form.hardware || "Standard Package",
        },
        items: validWindowLines.map((it) => ({
          productId: it.productId,
          productCode: it.productCode,
          description: it.width && it.height ? `${it.windowType} (${it.width}x${it.height}mm)` : it.windowType || "Window Unit",
          width: Number(it.width) || 0,
          height: Number(it.height) || 0,
          sqFt: Number(it.sqFt) || 0,
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.rate) || 0,
          total: Number(it.total) || 0,
        })),
        rawMaterials: validRawLines.map((rm) => ({
          productId: rm.productId,
          productCode: rm.productCode,
          description: rm.description,
          meter: Number(rm.meter) || 0,
          sqFt: Number(rm.sqFt) || 0,
          quantity: Number(rm.quantity) || 1,
          unitPrice: Number(rm.rate) || 0,
          rate: Number(rm.rate) || 0,
          total: Number(rm.total) || 0,
        })),
        subtotal: taxableSubtotal,
        grossSubtotal,
        discountType: "percentage",
        discountValue: discountPercent,
        discountPercentage: discountPercent,
        discountAmount,
        taxAmount: tax,
        totalAmount,
      };

      if (editingQuotation) {
        await quotationAPI.update(editingQuotation._id, payload);
        message.success("Quotation updated successfully.");
      } else {
        await quotationAPI.create(payload);
        message.success("Quotation drafted successfully.");
      }
      setViewMode("list");
      fetchQuotations();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to save quotation.");
    }
  };

  const handleDeleteQuotation = async () => {
    if (!editingQuotation) return;
    if (!window.confirm("Are you sure you want to delete this quotation?")) return;
    try {
      await quotationAPI.delete(editingQuotation._id);
      message.success("Quotation deleted successfully.");
      setViewMode("list");
      fetchQuotations();
    } catch (err) {
      message.error("Failed to delete quotation.");
    }
  };

  const handleConvertToInvoice = async () => {
    if (!editingQuotation) return;
    try {
      await quotationAPI.convertToInvoice(editingQuotation._id);
      message.success("Quotation successfully converted to Invoice!");
      setViewMode("list");
      fetchQuotations();
    } catch (err) {
      message.error("Failed to convert quotation to invoice.");
    }
  };

  const handleOpenPreviewFromForm = () => {
    const cust = customers.find((c) => c._id === form.customerId || c.id === form.customerId);

    const merged = {
      ...(editingQuotation || {}),
      quotationNumber: editingQuotation?.quotationNumber || "QT-DRAFT",
      quotationDate: editingQuotation?.quotationDate || new Date(),
      customer: cust,
      customerSnapshot: cust
        ? {
            name: cust.name,
            companyName: cust.companyName,
            email: cust.email,
            phone: cust.phone,
            gstNumber: form.clientGst || cust.gstNumber,
            address: extractAddressString(form.clientAddress),
            city: form.clientCity,
            state: form.clientState,
          }
        : editingQuotation?.customerSnapshot || {},
      projectName: form.projectName,
      clientAddress: extractAddressString(form.clientAddress),
      clientCity: form.clientCity,
      clientState: form.clientState,
      clientGst: form.clientGst,
      companyGstin: form.companyGstin || companySettings?.gstin || "",
      bankDetails: form.bankDetails,
      specifications: {
        series: form.profileSeries || "INVENTA",
        glass: form.glassType || "10 MM CLEAR TUFF GLASS",
        hardware: form.hardware || "Standard Package",
      },
      profileSeries: form.profileSeries,
      glassType: form.glassType,
      hardware: form.hardware,
      items: validWindowLines.map((it) => ({
        description: it.windowType || "Custom Window",
        width: Number(it.width) || 0,
        height: Number(it.height) || 0,
        sqFt: Number(it.sqFt) || 0,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.rate) || 0,
        amount: Number(it.total) || 0,
        total: Number(it.total) || 0,
      })),
      rawMaterials: validRawLines,
      subtotal: taxableSubtotal,
      grossSubtotal,
      discountPercentage: discountPercent,
      discountAmount,
      taxAmount: tax,
      totalAmount,
      termsAndConditions: form.termsAndConditions,
    };
    setPreviewQuotation(merged);
  };

  const handleSendEmail = async (quoteToEmail) => {
    const target = quoteToEmail || editingQuotation;
    if (!target) {
      message.warning("Please save this quotation first before sending.");
      return;
    }
    if (!target._id) {
      message.warning("Please click 'Save Quotation Changes' first to save, then click 'Send Quotation'.");
      return;
    }

    const custId = target.customer?._id || target.customer || form.customerId;
    const cust = customers.find((c) => c._id === custId || c.id === custId) || target.customer || target.customerSnapshot;
    const defaultEmail = cust?.email || target.customerSnapshot?.email || target.emailSentTo || "";

    const emailTo = window.prompt(
      `Enter client email address to send quotation (${target.quotationNumber || "Estimate"}):`,
      defaultEmail
    );
    if (!emailTo) return;

    setSendingEmail(true);
    try {
      const res = await quotationAPI.send(target._id, { emailTo });
      modal.success({
        title: "Quotation Sent Successfully!",
        content: (
          <div style={{ paddingTop: 8 }}>
            <p>
              The quotation document <b>{target.quotationNumber || ""}</b> has been successfully delivered to:
            </p>
            <p style={{ color: "#166534", fontWeight: 700, fontSize: 15, margin: "8px 0" }}>✉ {emailTo}</p>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
              The client will receive the dynamic window specifications, measurement rate sheet, raw materials, bank details, and terms &amp; conditions in their inbox.
            </p>
          </div>
        ),
        okText: "Done",
        okButtonProps: { style: { background: "#103567", borderColor: "#103567" } },
      });
      message.success(res.data?.message || `Quotation sent successfully to ${emailTo}`);
      fetchQuotations();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to send quotation email. Check network or server configuration.");
    } finally {
      setSendingEmail(false);
    }
  };

  const filteredQuotes = quotations.filter((q) => {
    const custName = q.customer?.companyName || q.customer?.name || q.customerName || "";
    const matches =
      custName.toLowerCase().includes(search.toLowerCase()) ||
      (q.quotationNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (q.projectName || "").toLowerCase().includes(search.toLowerCase());
    if (!matches) return false;
    if (statusFilter === "All statuses") return true;
    return (q.status || "draft").toLowerCase() === statusFilter.toLowerCase();
  });

  const totalPipeline = quotations.reduce((acc, q) => acc + (Number(q.totalAmount) || 0), 0);
  const winRate =
    quotations.length > 0
      ? Math.round((quotations.filter((q) => q.status === "approved").length / quotations.length) * 100)
      : 0;

  // ── IF IN FULL-PAGE FORM MODE (NO MODAL OVERLAY) ─────────────────────────────
  if (viewMode === "form") {
    return (
      <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 40 }}>
        {/* Navigation Breadcrumb & Back Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="crumb" style={{ marginBottom: 0 }}>
            ARCIOX <span style={{ margin: "0 6px" }}>/</span> QUOTATIONS <span style={{ margin: "0 6px" }}>/</span>{" "}
            <b>{editingQuotation ? `EDIT ${editingQuotation.quotationNumber}` : "NEW WINDOW ESTIMATION"}</b>
          </div>
          <button className="btn" onClick={() => setViewMode("list")}>
            ← Back to Quotations Register
          </button>
        </div>

        {/* Page Title & Main Action Buttons */}
        <div className="pagehead" style={{ marginBottom: 20 }}>
          <div>
            <h1>{editingQuotation ? `Quotation: ${editingQuotation.quotationNumber}` : "Create Window Quotation"}</h1>
            <p>
              DD UPVC Windows &amp; Doors specification costing, Prominance profile pricing &amp; automatic Sq. Ft fabrication pricing engine.
            </p>
          </div>
          <div className="actions">
            {editingQuotation && (
              <button
                className="btn"
                style={{ color: "#166534", borderColor: "#bbf7d0", background: "#f0fdf4", fontWeight: 600 }}
                onClick={() => handleSendEmail(editingQuotation)}
                disabled={sendingEmail}
              >
                ✉ Send Quotation
              </button>
            )}
            <button
              className="btn"
              style={{ color: "#103567", borderColor: "#bfdbfe", background: "#eff6ff", fontWeight: 600 }}
              onClick={handleOpenPreviewFromForm}
            >
              👁 View Quotation Template
            </button>
            {editingQuotation && (
              <button className="btn" style={{ color: "var(--red)", borderColor: "#fca5a5" }} onClick={handleDeleteQuotation}>
                🗑 Delete
              </button>
            )}
            {editingQuotation && (
              <button className="btn" style={{ color: "var(--blue)", borderColor: "#bfdbfe" }} onClick={handleConvertToInvoice}>
                ➔ Convert to Invoice
              </button>
            )}
            <button className="btn" onClick={() => setViewMode("list")}>
              Cancel
            </button>
            <button className="btn primary" onClick={handleSaveQuotation} style={{ background: "#103567", borderColor: "#103567" }}>
              💾 {editingQuotation ? "Save Quotation Changes" : "Draft Quotation"}
            </button>
          </div>
        </div>

        {/* Section 1: Customer & Site Details Card */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
            <div>
              <h3 style={{ margin: 0, color: "#103567" }}>1. Client &amp; Proposal Details</h3>
              <small className="muted">Specify client account, project site and estimation validity.</small>
            </div>
            <div>{statusPill(form.status)}</div>
          </div>
          <div className="cardbody">
            <div className="formgrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div className="field">
                <label>Customer *</label>
                <select value={form.customerId} onChange={(e) => handleCustomerSelect(e.target.value)}>
                  <option value="">-- Select Customer --</option>
                  {customers.map((c) => (
                    <option key={c._id || c.id} value={c._id || c.id}>
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
                  placeholder="e.g. Green Valley Residence"
                />
              </div>
              <div className="field">
                <label>Site / Street Address</label>
                <input
                  value={extractAddressString(form.clientAddress)}
                  onChange={(e) => setForm({ ...form, clientAddress: e.target.value })}
                  placeholder="e.g. Kudri Road / Sector 4"
                />
              </div>
              <div className="field">
                <label>City</label>
                <input
                  value={form.clientCity}
                  onChange={(e) => setForm({ ...form, clientCity: e.target.value })}
                  placeholder="e.g. Jabalpur / Shahdol"
                />
              </div>
              <div className="field">
                <label>State</label>
                <input
                  value={form.clientState}
                  onChange={(e) => setForm({ ...form, clientState: e.target.value })}
                  placeholder="e.g. Madhya Pradesh"
                />
              </div>
              <div className="field">
                <label>Client GSTIN (Optional)</label>
                <input
                  value={form.clientGst}
                  onChange={(e) => setForm({ ...form, clientGst: e.target.value })}
                  placeholder="e.g. 23XXXXX0000X0XX"
                />
              </div>
              <div className="field">
                <label>Validity Until</label>
                <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
              </div>
              <div className="field">
                <label>Quotation Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent to Customer</option>
                  <option value="approved">Approved / Accepted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Technical Specifications Banner Card (Strictly Inventa & Optima) */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
            <h3 style={{ margin: 0, color: "#103567" }}>2. Technical Window Specifications</h3>
          </div>
          <div className="cardbody">
            <div className="formgrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <div className="field">
                <label>Default Series (Inventa or Optima only)</label>
                <select
                  value={form.profileSeries}
                  onChange={(e) => setForm({ ...form, profileSeries: e.target.value })}
                  style={{ fontWeight: 600, color: "#103567" }}
                >
                  {SERIES_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt} SERIES
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Glass Specification</label>
                <input
                  value={form.glassType}
                  onChange={(e) => setForm({ ...form, glassType: e.target.value })}
                  placeholder="e.g. 10 MM CLEAR TUFF GLASS"
                />
              </div>
              <div className="field">
                <label>Hardware Package</label>
                <input
                  value={form.hardware}
                  onChange={(e) => setForm({ ...form, hardware: e.target.value })}
                  placeholder="e.g. Standard Multi-point Touch Locks"
                />
              </div>
              <div className="field" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <label style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                  <input
                    type="checkbox"
                    checked={form.installationIncluded}
                    onChange={(e) => setForm({ ...form, installationIncluded: e.target.checked })}
                    style={{ width: "auto", margin: 0 }}
                  />
                  <span>Installation &amp; FOR Delivery Included</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Window & Door Measurement Grid (Filtered to WINDOW & DOOR designs + "OTHER" option) */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
            <div>
              <h3 style={{ margin: 0, color: "#103567" }}>3. Window &amp; Door Measurement Grid</h3>
              <small className="muted">
                Select from 59 UPVC Window &amp; Door Master Designs or choose <b>"➕ Other / Custom Window"</b> to enter manually.
              </small>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <select
                className="btn"
                style={{ fontSize: 12, padding: "5px 10px" }}
                value={windowCategoryFilter}
                onChange={(e) => setWindowCategoryFilter(e.target.value)}
              >
                {WINDOW_DESIGN_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <button className="btn primary" style={{ fontSize: 12 }} onClick={handleAddLine}>
                ＋ Add Window / Door
              </button>
            </div>
          </div>

          <div className="tablewrap" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ width: 40, textAlign: "center" }}>#</th>
                  <th style={{ minWidth: 260 }}>Select UPVC Window / Door Design</th>
                  <th style={{ minWidth: 180 }}>Window Description</th>
                  <th style={{ width: 90 }}>Width (mm)</th>
                  <th style={{ width: 90 }}>Height (mm)</th>
                  <th style={{ width: 85 }}>Sq. Ft</th>
                  <th style={{ width: 85, textAlign: "center" }}>Qty</th>
                  <th style={{ width: 100 }}>Rate (₹/sqft)</th>
                  <th style={{ width: 110, textAlign: "right" }}>Amount (₹)</th>
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
                        onChange={(e) => handleWindowSelect(idx, e.target.value)}
                      >
                        <option value="">-- Select Window / Door Design --</option>
                        <option value="OTHER" style={{ fontWeight: 700, color: "#103567" }}>
                          ➕ Other / Custom Window (Enter Manually)
                        </option>
                        {WINDOW_DESIGN_CATEGORIES.filter((c) => c !== "All Categories")
                          .filter((cat) => windowCategoryFilter === "All Categories" || cat === windowCategoryFilter)
                          .map((cat) => (
                            <optgroup key={cat} label={`🪟 ${cat}`}>
                              {UPVC_WINDOW_DESIGNS.filter((w) => w.category === cat).map((w) => (
                                <option key={w.id} value={w.id}>
                                  {w.name} (₹{w.defaultRate}/sqft)
                                </option>
                              ))}
                            </optgroup>
                          ))}
                      </select>
                    </td>
                    <td>
                      <input
                        style={{ width: "100%", fontSize: 12, padding: "5px 8px" }}
                        placeholder={item.productId === "OTHER" ? "Enter custom window name..." : "e.g. 3 Track Sliding Window"}
                        value={item.windowType}
                        onChange={(e) => handleLineChange(idx, "windowType", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ width: "100%", fontSize: 12, padding: "5px 6px" }}
                        placeholder="W (mm)"
                        value={item.width !== undefined ? item.width : ""}
                        onChange={(e) => handleLineChange(idx, "width", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ width: "100%", fontSize: 12, padding: "5px 6px" }}
                        placeholder="H (mm)"
                        value={item.height !== undefined ? item.height : ""}
                        onChange={(e) => handleLineChange(idx, "height", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        style={{ width: "100%", fontSize: 12, padding: "5px 6px", background: "#f8fafc", fontWeight: 600 }}
                        value={item.sqFt !== undefined ? item.sqFt : ""}
                        onChange={(e) => handleLineChange(idx, "sqFt", e.target.value)}
                        placeholder="Sq. Ft"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        style={{ width: "100%", minWidth: 65, fontSize: 12, padding: "5px 6px", textAlign: "center" }}
                        value={item.quantity !== undefined ? item.quantity : 1}
                        onChange={(e) => handleLineChange(idx, "quantity", e.target.value)}
                        placeholder="Qty"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ width: "100%", fontSize: 12, padding: "5px 6px" }}
                        value={item.rate !== undefined ? item.rate : ""}
                        onChange={(e) => handleLineChange(idx, "rate", e.target.value)}
                        placeholder="₹ Rate"
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
                    TOTAL WINDOW FABRICATION AREA:
                  </td>
                  <td style={{ padding: "10px", color: "#103567" }}>{totalSqFt.toFixed(2)} Sq. Ft</td>
                  <td style={{ padding: "10px", textAlign: "right" }} colSpan={2}>
                    WINDOW SUBTOTAL:
                  </td>
                  <td style={{ textAlign: "right", padding: "10px", color: "#103567", fontSize: 14 }}>
                    ₹{windowSubtotal.toLocaleString("en-IN")}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Section 4: Raw Materials Grid (Meter, Sq. Ft & Qty Columns + "OTHER" option) */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
            <div>
              <h3 style={{ margin: 0, color: "#103567" }}>4. Raw Materials &amp; Profiles Grid</h3>
              <small className="muted">
                Select from Prominance raw materials catalogue or choose <b>"➕ Other / Custom Raw Material"</b> to enter manually with <b>Meter (m)</b>, <b>Sq. Ft</b>, and <b>Qty</b>.
              </small>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <select
                className="btn"
                style={{ fontSize: 12, padding: "5px 10px" }}
                value={rawCategoryFilter}
                onChange={(e) => setRawCategoryFilter(e.target.value)}
              >
                <option value="All">All Raw Material Categories</option>
                {distinctRawCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button className="btn primary" style={{ fontSize: 12 }} onClick={handleAddRawMaterial}>
                ＋ Add Raw Material
              </button>
            </div>
          </div>

          <div className="tablewrap" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ width: 40, textAlign: "center" }}>#</th>
                  <th style={{ minWidth: 260 }}>Select Prominance Raw Material</th>
                  <th style={{ minWidth: 180 }}>Profile / Item Description</th>
                  <th style={{ width: 95 }}>Meter (m)</th>
                  <th style={{ width: 85 }}>Sq. Ft</th>
                  <th style={{ width: 85, textAlign: "center" }}>Qty</th>
                  <th style={{ width: 95 }}>Rate (₹)</th>
                  <th style={{ width: 110, textAlign: "right" }}>Amount (₹)</th>
                  <th style={{ width: 40, textAlign: "center" }}>✕</th>
                </tr>
              </thead>
              <tbody>
                {form.rawMaterials && form.rawMaterials.length > 0 ? (
                  form.rawMaterials.map((rm, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", fontWeight: 600 }}>{idx + 1}</td>
                      <td>
                        <select
                          style={{ width: "100%", fontSize: 12, padding: "6px 8px" }}
                          value={rm.productId || ""}
                          onChange={(e) => handleRawMaterialSelect(idx, e.target.value)}
                        >
                          <option value="">-- Select Raw Material --</option>
                          <option value="OTHER" style={{ fontWeight: 700, color: "#103567" }}>
                            ➕ Other / Custom Raw Material (Enter Manually)
                          </option>
                          {distinctRawCategories
                            .filter((cat) => rawCategoryFilter === "All" || cat === rawCategoryFilter)
                            .map((cat) => (
                              <optgroup key={cat} label={`📦 ${cat}`}>
                                {products
                                  .filter((p) => p.category === cat)
                                  .map((p) => {
                                    const rateVal = p.pricePerMeter > 0 ? p.pricePerMeter : p.pricePerPiece || 0;
                                    return (
                                      <option key={p._id || p.id} value={p._id || p.id}>
                                        {p.name} {p.productCode ? `(${p.productCode})` : ""} - ₹{rateVal}/m
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
                          placeholder={rm.productId === "OTHER" ? "Enter custom raw material description..." : "Profile / Item Description"}
                          value={rm.description}
                          onChange={(e) => handleRawMaterialChange(idx, "description", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          style={{ width: "100%", fontSize: 12, padding: "5px 6px" }}
                          placeholder="Meters (m)"
                          value={rm.meter !== undefined ? rm.meter : ""}
                          onChange={(e) => handleRawMaterialChange(idx, "meter", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          style={{ width: "100%", fontSize: 12, padding: "5px 6px" }}
                          placeholder="Sq. Ft"
                          value={rm.sqFt !== undefined ? rm.sqFt : ""}
                          onChange={(e) => handleRawMaterialChange(idx, "sqFt", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          style={{ width: "100%", minWidth: 65, fontSize: 12, padding: "5px 6px", textAlign: "center" }}
                          placeholder="Qty"
                          value={rm.quantity !== undefined ? rm.quantity : 1}
                          onChange={(e) => handleRawMaterialChange(idx, "quantity", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          style={{ width: "100%", fontSize: 12, padding: "5px 6px" }}
                          placeholder="Rate ₹"
                          value={rm.rate !== undefined ? rm.rate : ""}
                          onChange={(e) => handleRawMaterialChange(idx, "rate", e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#103567", fontSize: 13 }}>
                        ₹{Number(rm.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="btn"
                          style={{ color: "var(--red)", padding: "2px 6px", fontSize: 11 }}
                          onClick={() => handleRemoveRawMaterial(idx)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "16px", color: "#64748b" }}>
                      No raw materials added yet. Click <b>"＋ Add Raw Material"</b> above if this quotation includes separate profile raw materials.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "2px solid #cbd5e1" }}>
                  <td colSpan={3} style={{ textAlign: "right", padding: "10px" }}>
                    TOTAL RAW MATERIALS:
                  </td>
                  <td style={{ padding: "10px", color: "#103567" }}>{totalRawMeters.toFixed(2)} m</td>
                  <td style={{ padding: "10px", color: "#103567" }}>{totalRawSqFt.toFixed(2)} Sq. Ft</td>
                  <td style={{ padding: "10px", color: "#103567" }}>{totalRawQty} Qty</td>
                  <td style={{ padding: "10px", textAlign: "right" }}>SUBTOTAL:</td>
                  <td style={{ textAlign: "right", padding: "10px", color: "#103567", fontSize: 14 }}>
                    ₹{rawMaterialSubtotal.toLocaleString("en-IN")}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Section 5: Bank Details & Company GSTIN */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
            <div>
              <h3 style={{ margin: 0, color: "#103567" }}>5. Bank Details &amp; Company GSTIN (Printed on Quotation)</h3>
              <small className="muted">Default bank information and tax identifier shown to customer for payment clearance.</small>
            </div>
          </div>
          <div className="cardbody">
            {companySettings?.bankDetails && companySettings.bankDetails.length > 0 && (
              <div style={{ marginBottom: 16, background: "#f8fafc", padding: "10px 14px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#103567", display: "block", marginBottom: 4 }}>
                  🏦 Choose from Configured Bank Accounts (Settings)
                </label>
                <select
                  style={{ width: "100%", fontSize: 13, padding: "6px 10px", fontWeight: 600, color: "#103567", background: "#ffffff" }}
                  value={
                    companySettings.bankDetails.find(
                      (b) => b.accountNumber === form.bankDetails?.accountNumber
                    )?.id || "CUSTOM"
                  }
                  onChange={(e) => {
                    const sel = companySettings.bankDetails.find((b) => b.id === e.target.value);
                    if (sel) {
                      setForm((prev) => ({
                        ...prev,
                        bankDetails: {
                          accountHolder: sel.accountHolder,
                          accountNumber: sel.accountNumber,
                          ifscCode: sel.ifscCode,
                          branch: sel.branch,
                          bankName: sel.bankName,
                        },
                      }));
                    }
                  }}
                >
                  <option value="CUSTOM">-- Select Bank Account to Auto-fill or Edit Below --</option>
                  {companySettings.bankDetails.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName || "Bank"} — A/C {b.accountNumber} ({b.accountHolder}) {b.isDefault ? "★ Default" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="formgrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <div className="field">
                <label>Company GSTIN</label>
                <input
                  value={form.companyGstin !== undefined && form.companyGstin !== null ? form.companyGstin : (companySettings?.gstin || "")}
                  onChange={(e) => setForm({ ...form, companyGstin: e.target.value })}
                  placeholder={companySettings?.gstin || "Enter GSTIN"}
                />
              </div>
              <div className="field">
                <label>A/C Holder Name</label>
                <input
                  value={form.bankDetails?.accountHolder || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      bankDetails: { ...form.bankDetails, accountHolder: e.target.value },
                    })
                  }
                  placeholder="e.g. DD UPVC WINDOW SYSTEMS"
                />
              </div>
              <div className="field">
                <label>Account Number</label>
                <input
                  value={form.bankDetails?.accountNumber || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      bankDetails: { ...form.bankDetails, accountNumber: e.target.value },
                    })
                  }
                  placeholder="e.g. 44250720832"
                />
              </div>
              <div className="field">
                <label>IFSC Code</label>
                <input
                  value={form.bankDetails?.ifscCode || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      bankDetails: { ...form.bankDetails, ifscCode: e.target.value },
                    })
                  }
                  placeholder="e.g. SBIN0061553"
                />
              </div>
              <div className="field">
                <label>Branch</label>
                <input
                  value={form.bankDetails?.branch || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      bankDetails: { ...form.bankDetails, branch: e.target.value },
                    })
                  }
                  placeholder="e.g. Medical College Shahdol M.P."
                />
              </div>
              <div className="field">
                <label>Bank Name</label>
                <input
                  value={form.bankDetails?.bankName || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      bankDetails: { ...form.bankDetails, bankName: e.target.value },
                    })
                  }
                  placeholder="e.g. State Bank of India (SBI)"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 6 & 7: Terms and Cost Summary with Optional Discount */}
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 }}>
          <div className="card">
            <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
              <h3 style={{ margin: 0, color: "#103567" }}>6. Terms and Conditions</h3>
            </div>
            <div className="cardbody">
              <div className="field">
                <label>Commercial &amp; Payment Terms</label>
                <textarea
                  rows={6}
                  value={form.termsAndConditions}
                  onChange={(e) => setForm({ ...form, termsAndConditions: e.target.value })}
                  placeholder="Terms and conditions for quotation validity, warranty, scaffolding, power supply..."
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
              <h3 style={{ margin: 0, color: "#103567" }}>7. Quotation Cost Summary</h3>
            </div>
            <div className="cardbody">
              {windowSubtotal > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                  <span className="muted">Windows Subtotal ({totalSqFt.toFixed(2)} Sq. Ft):</span>
                  <b>₹{windowSubtotal.toLocaleString("en-IN")}</b>
                </div>
              )}
              {rawMaterialSubtotal > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                  <span className="muted">Raw Materials Subtotal ({totalRawMeters.toFixed(2)} m):</span>
                  <b>₹{rawMaterialSubtotal.toLocaleString("en-IN")}</b>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 10,
                  fontSize: 13,
                  borderTop: "1px dashed #cbd5e1",
                  paddingTop: 8,
                }}
              >
                <span className="muted">Gross Subtotal:</span>
                <b>₹{grossSubtotal.toLocaleString("en-IN")}</b>
              </div>

              {/* Optional Discount Input */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  padding: "10px 12px",
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0 }}>
                    Discount % (Optional):
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      style={{ width: 75, padding: "4px 8px", fontSize: 13, textAlign: "right", borderRadius: 4 }}
                      value={form.discountPercentage !== undefined ? form.discountPercentage : ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          discountPercentage: e.target.value === "" ? "" : Math.max(0, Math.min(100, Number(e.target.value))),
                        })
                      }
                      placeholder="0"
                    />
                    <span style={{ fontWeight: 600, color: "#475569" }}>%</span>
                  </div>
                </div>
                {discountAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "#dc2626" }}>
                    <span>Discount Deduction:</span>
                    <b>- ₹{discountAmount.toLocaleString("en-IN")} ({discountPercent}%)</b>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                <span className="muted">Taxable Subtotal:</span>
                <b>₹{taxableSubtotal.toLocaleString("en-IN")}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13 }}>
                <span className="muted">GST (18%):</span>
                <b>₹{tax.toLocaleString("en-IN")}</b>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 18,
                  paddingTop: 12,
                  borderTop: "2px solid #cbd5e1",
                  marginTop: 8,
                }}
              >
                <span>Total Quotation Estimate:</span>
                <strong style={{ color: "#103567" }}>₹{totalAmount.toLocaleString("en-IN")}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 24,
            paddingTop: 16,
            borderTop: "1px solid var(--line)",
          }}
        >
          <button className="btn" onClick={() => setViewMode("list")}>
            ← Back to Quotations Register
          </button>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {editingQuotation && (
              <button
                className="btn"
                style={{ color: "#166534", borderColor: "#bbf7d0", background: "#f0fdf4", fontWeight: 600 }}
                onClick={() => handleSendEmail(editingQuotation)}
                disabled={sendingEmail}
              >
                ✉ Send Quotation
              </button>
            )}
            <button
              className="btn"
              style={{ color: "#103567", borderColor: "#bfdbfe", background: "#eff6ff", fontWeight: 600 }}
              onClick={handleOpenPreviewFromForm}
            >
              👁 View Quotation Template
            </button>
            <button className="btn" onClick={() => setViewMode("list")}>
              Cancel
            </button>
            <button className="btn primary" onClick={handleSaveQuotation} style={{ background: "#103567", borderColor: "#103567" }}>
              💾 {editingQuotation ? "Save Quotation Changes" : "Draft Quotation"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW (DEFAULT REGISTER TABLE) ───────────────────────────────────────
  return (
    <>
      <div className="crumb">
        ARCIOX <span style={{ margin: "0 6px" }}>/</span> QUOTATIONS
      </div>
      <div className="pagehead">
        <div>
          <h1>Quotations &amp; Estimations</h1>
          <p>DD UPVC Windows dynamic rate sheet, Prominance profile sizing &amp; cost calculator.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => message.info("Exporting quotations...")}>
            ⇩ Export
          </button>
          <button className="btn primary" onClick={handleOpenNew}>
            ＋ New quotation
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid stats">
        <div className="card stat">
          <div className="statrow">
            <span>Quotation pipeline</span>
            <span className="staticon">▧</span>
          </div>
          <strong>₹{totalPipeline.toLocaleString("en-IN")}</strong>
          <span className="trend">{quotations.length} total quotes issued</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Win rate</span>
            <span className="staticon">⚡</span>
          </div>
          <strong style={{ color: "var(--green)" }}>{winRate}%</strong>
          <span className="trend">Converted to confirmed orders</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Average deal size</span>
            <span className="staticon">₹</span>
          </div>
          <strong>
            ₹{(quotations.length ? Math.round(totalPipeline / quotations.length) : 0).toLocaleString("en-IN")}
          </strong>
          <span className="trend">Per active proposal</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Catalogue Profiles</span>
            <span className="staticon">🪟</span>
          </div>
          <strong style={{ color: "var(--blue)" }}>{products.length}</strong>
          <span className="trend">Across 12 Prominance categories</span>
        </div>
      </div>

      {/* Main Quotations Table */}
      <div className="card">
        <div className="cardhead">
          <div>
            <h2>Quotations Register</h2>
            <small className="muted">Live proposal status, revision histories and customer conversion tracking.</small>
          </div>
          <div className="actions">
            <input
              type="text"
              placeholder="Search quote #, client, project…"
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
              <option>All statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Quotation #</th>
                <th>Client</th>
                <th>Project Name</th>
                <th>Total Value</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.length > 0 ? (
                filteredQuotes.map((r, i) => (
                  <tr key={r._id || i}>
                    <td>
                      <b>{r.quotationNumber || `QT-2026-${String(i + 1).padStart(4, "0")}`}</b>
                    </td>
                    <td>
                      <div className="customer">
                        <div className="miniavatar">
                          {(r.customer?.companyName || r.customer?.name || "C").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <b>{r.customer?.companyName || r.customer?.name || "Client Project"}</b>
                          <small>{r.customer?.contactPerson || r.customer?.email || r.customer?.phone}</small>
                        </div>
                      </div>
                    </td>
                    <td>{r.projectName || "Residential Package"}</td>
                    <td>
                      <b>₹{Number(r.totalAmount || 0).toLocaleString("en-IN")}</b>
                    </td>
                    <td>{statusPill(r.status || "draft")}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn"
                          style={{ padding: "6px 12px", fontWeight: 600, color: "var(--navy)" }}
                          onClick={() => handleViewOrEdit(r)}
                        >
                          View / Edit ↗
                        </button>
                        <button
                          className="btn"
                          style={{
                            padding: "6px 10px",
                            fontWeight: 600,
                            color: "#166534",
                            borderColor: "#bbf7d0",
                            background: "#f0fdf4",
                          }}
                          onClick={() => handleSendEmail(r)}
                          title="Send Quotation directly to Client Email"
                        >
                          ✉ Send
                        </button>
                        <button
                          className="btn"
                          style={{
                            padding: "6px 10px",
                            fontWeight: 600,
                            color: "#103567",
                            borderColor: "#bfdbfe",
                            background: "#eff6ff",
                          }}
                          onClick={() => setPreviewQuotation(r)}
                          title="View / Print DD UPVC Quotation Template"
                        >
                          👁
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6">
                    <div className="emptyhint">
                      <b>No quotations found</b>
                      {loading ? "Loading quotations..." : "Click '+ New quotation' to build a cost estimate."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 16px", color: "#8390a2", fontSize: 11, borderTop: "1px solid var(--line)" }}>
          Showing {filteredQuotes.length} quotations · DD UPVC Window &amp; Door Costing Engine
        </div>
      </div>

      {/* Abhishek Jain DD UPVC Quotation Template Preview & Print/Email Modal */}
      {previewQuotation && (
        <ProformaInvoiceTemplate
          quotation={{
            ...previewQuotation,
            companyGstin: companySettings?.gstin || (previewQuotation.companyGstin !== "23EVFPG6600A1ZB" ? previewQuotation.companyGstin : "") || previewQuotation.companyGstin || "",
          }}
          settings={companySettings}
          type="quotation"
          onClose={() => setPreviewQuotation(null)}
          onRefresh={fetchQuotations}
        />
      )}
    </>
  );
}
