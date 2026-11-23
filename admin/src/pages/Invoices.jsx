import React, { useState, useEffect } from "react";
import { App } from "antd";
import dayjs from "dayjs";
import { invoiceAPI, customerAPI, productAPI, settingsAPI } from "../services/api";
import ProformaInvoiceTemplate from "../components/ProformaInvoiceTemplate";
import { UPVC_WINDOW_DESIGNS, WINDOW_DESIGN_CATEGORIES } from "../data/windowDesigns";

function statusPill(s) {
  const x = (s || "").toLowerCase();
  let c = /paid|settle/.test(x) && !/unpaid|due|part/.test(x)
    ? "green"
    : /overdue|cancelled/.test(x)
    ? "red"
    : /due|unpaid/.test(x)
    ? "red"
    : /part/.test(x)
    ? "amber"
    : "blue";
  let label = s ? s.charAt(0).toUpperCase() + s.slice(1) : "Due";
  if (x === "unpaid") label = "Due";
  if (x === "settle" || x === "settled") label = "Settle";
  return <span className={`pill ${c}`}>{label}</span>;
}

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

function extractCityString(cust, billing) {
  if (cust?.city) return extractAddressString(cust.city);
  if (billing?.city) return extractAddressString(billing.city);
  return "";
}

function extractStateString(cust, billing) {
  if (cust?.state) return extractAddressString(cust.state);
  if (billing?.state) return extractAddressString(billing.state);
  return "";
}

const SERIES_OPTIONS = ["INVENTA", "OPTIMA"];

export default function Invoices() {
  const { message, modal } = App.useApp();
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [companySettings, setCompanySettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");

  const [viewMode, setViewMode] = useState("list"); // "list" | "form"
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Category filters for Section 3 & 4
  const [windowCategoryFilter, setWindowCategoryFilter] = useState("All Categories");
  const [rawCategoryFilter, setRawCategoryFilter] = useState("All");

  const [form, setForm] = useState({
    customerId: "",
    invoiceNumber: "",
    quotationNumber: "",
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
    invoiceDate: dayjs().format("YYYY-MM-DD"),
    dueDate: dayjs().add(15, "day").format("YYYY-MM-DD"),
    status: "due",
    paymentStatus: "due",
    paymentTerms: "net-30",
    paidAmount: 0,
    profileSeries: "INVENTA",
    glassType: "",
    hardware: "",
    installationIncluded: true,
    discountPercentage: "",
    termsAndConditions:
      "1. Goods once sold will not be taken back or exchanged.\n2. Payment strictly as per agreed payment terms.\n3. Warranty valid as per Prominance Profile / DD UPVC manufacturer guidelines.",
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
    notes: "",
  });

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await invoiceAPI.list({ limit: 100 });
      setInvoices(res.data?.invoices || res.data?.data?.invoices || []);
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await customerAPI.list({ limit: 100 });
      setCustomers(res.data?.customers || res.data?.data?.customers || []);
    } catch (err) {
      console.error("Failed to fetch customers:", err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await productAPI.list({ limit: 300 });
      setProducts(res.data?.products || []);
    } catch (err) {
      console.error("Failed to fetch products catalogue:", err);
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
    fetchInvoices();
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
    const cust = customers.find((c) => (c._id || c.id) === custId);
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
    setEditingInvoice(null);
    const defaultBank =
      companySettings?.bankDetails && Array.isArray(companySettings.bankDetails)
        ? companySettings.bankDetails.find((b) => b.isDefault) || companySettings.bankDetails[0] || {}
        : {};

    const prefix = companySettings?.invoicePrefix || "INV-";
    const nextNum = `${prefix}${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, "0")}`;

    setForm({
      customerId: customers[0]?._id || "",
      invoiceNumber: nextNum,
      quotationNumber: "",
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
      invoiceDate: dayjs().format("YYYY-MM-DD"),
      dueDate: dayjs().add(15, "day").format("YYYY-MM-DD"),
      status: "due",
      paymentStatus: "due",
      paymentTerms: "net-30",
      paidAmount: 0,
      profileSeries: "INVENTA",
      glassType: "",
      hardware: "",
      installationIncluded: true,
      discountPercentage: "",
      termsAndConditions:
        "1. Goods once sold will not be taken back or exchanged.\n2. Payment strictly as per agreed payment terms.\n3. Warranty valid as per Prominance Profile / DD UPVC manufacturer guidelines.",
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
      notes: "",
    });
    setViewMode("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleViewOrEdit = (inv) => {
    setEditingInvoice(inv);

    let rawItems = Array.isArray(inv.items) ? inv.items : Array.isArray(inv.lineItems) ? inv.lineItems : [];
    if (typeof rawItems === "string") {
      try { rawItems = JSON.parse(rawItems) || []; } catch (e) { rawItems = []; }
    }

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

    let mappedRaw = [];
    if (Array.isArray(inv.rawMaterials)) {
      mappedRaw = inv.rawMaterials;
    } else if (typeof inv.rawMaterials === "string") {
      try {
        mappedRaw = JSON.parse(inv.rawMaterials) || [];
      } catch (e) {
        mappedRaw = [];
      }
    }

    const custId = inv.customer?._id || inv.customer?.id || inv.customer || "";
    let billing = inv.customerSnapshot?.billingAddress || inv.customer?.billingAddress;
    if (typeof billing === "string") {
      try { billing = JSON.parse(billing); } catch (e) { billing = {}; }
    }

    let bank = inv.bankDetails;
    if (typeof bank === "string") {
      try { bank = JSON.parse(bank); } catch (e) { bank = null; }
    }
    if (!bank || !bank.accountNumber) {
      bank =
        companySettings?.bankDetails && Array.isArray(companySettings.bankDetails)
          ? companySettings.bankDetails.find((b) => b.isDefault) || companySettings.bankDetails[0] || {}
          : {};
    }

    const seriesVal = SERIES_OPTIONS.includes((inv.profileSeries || "").toUpperCase())
      ? (inv.profileSeries || "").toUpperCase()
      : "INVENTA";

    const street = extractAddressString(inv.clientAddress) || extractAddressString(inv.customerSnapshot?.address) || extractAddressString(billing?.street) || extractAddressString(billing?.address) || "";
    const city = inv.clientCity || extractCityString(inv.customerSnapshot || inv.customer, billing);
    const state = inv.clientState || extractStateString(inv.customerSnapshot || inv.customer, billing);

    const invStatus = (inv.paymentStatus === "unpaid" ? "due" : (inv.paymentStatus || inv.status || "due")).toLowerCase();
    const isSettled = /paid|settle/.test(invStatus);
    const invTotal = Number(inv.totalAmount || inv.grandTotal || 0);
    const resolvedInitialPaid = Number(inv.paidAmount) > 0 ? Number(inv.paidAmount) : (isSettled ? invTotal : 0);

    setForm({
      customerId: custId,
      invoiceNumber: inv.invoiceNumber || "",
      quotationNumber: inv.quotationNumber || inv.quotation?.quotationNumber || "",
      projectName: inv.projectName || "",
      clientAddress: street,
      clientCity: city,
      clientState: state,
      clientGst: inv.clientGst || inv.customerSnapshot?.gstNumber || inv.customer?.gstNumber || "",
      companyGstin: (inv.companyGstin && inv.companyGstin !== "23EVFPG6600A1ZB") ? inv.companyGstin : (companySettings?.gstin || inv.companyGstin || ""),
      bankDetails: bank,
      invoiceDate: inv.invoiceDate ? dayjs(inv.invoiceDate).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
      dueDate: inv.dueDate ? dayjs(inv.dueDate).format("YYYY-MM-DD") : dayjs().add(15, "day").format("YYYY-MM-DD"),
      status: invStatus,
      paymentStatus: invStatus,
      paymentTerms: inv.paymentTerms || "net-30",
      paidAmount: resolvedInitialPaid,
      profileSeries: seriesVal,
      glassType: inv.glassType || "",
      hardware: inv.hardware || "",
      installationIncluded: inv.installationIncluded !== undefined ? inv.installationIncluded : true,
      discountPercentage: inv.discountPercentage !== undefined && inv.discountPercentage !== null ? inv.discountPercentage : inv.discountValue !== undefined ? inv.discountValue : "",
      termsAndConditions:
        inv.termsAndConditions ||
        "1. Goods once sold will not be taken back or exchanged.\n2. Payment strictly as per agreed payment terms.\n3. Warranty valid as per Prominance Profile / DD UPVC manufacturer guidelines.",
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
      notes: inv.notes || "",
    });

    setViewMode("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Line item handlers for Section 3 (Windows & Doors)
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

  const handleRemoveLine = (index) => {
    if (form.lineItems.length === 1) return;
    const updated = form.lineItems.filter((_, i) => i !== index);
    setForm({ ...form, lineItems: updated });
  };

  const handleWindowSelect = (index, value) => {
    const updated = [...form.lineItems];
    if (value === "OTHER") {
      updated[index] = {
        ...updated[index],
        productId: "OTHER",
        productCode: "",
        windowType: "",
        rate: updated[index].rate || 690,
      };
      setForm({ ...form, lineItems: updated });
      return;
    }
    const design = UPVC_WINDOW_DESIGNS.find((w) => w.id === value);
    if (design) {
      const w = Number(updated[index].width) || 1200;
      const h = Number(updated[index].height) || 1200;
      const computedSqFt = Math.round(((w * h) / 90900) * 100) / 100;
      const rate = design.defaultRate || 690;
      const qty = Number(updated[index].quantity) || 1;
      const total = Math.round(computedSqFt * rate * qty * 10) / 10;

      updated[index] = {
        ...updated[index],
        productId: design.id,
        productCode: design.id,
        windowType: design.name,
        width: updated[index].width || 1200,
        height: updated[index].height || 1200,
        sqFt: computedSqFt,
        rate,
        total,
      };
    } else {
      updated[index] = {
        ...updated[index],
        productId: "",
        productCode: "",
        windowType: "",
      };
    }
    setForm({ ...form, lineItems: updated });
  };

  const handleWindowFieldChange = (index, field, value) => {
    const updated = [...form.lineItems];
    updated[index][field] = value;

    if (field === "width" || field === "height" || field === "rate" || field === "quantity" || field === "sqFt") {
      const w = Number(field === "width" ? value : updated[index].width) || 0;
      const h = Number(field === "height" ? value : updated[index].height) || 0;
      let computedSqFt = updated[index].sqFt;
      if (w > 0 && h > 0 && field !== "sqFt") {
        computedSqFt = Math.round(((w * h) / 90900) * 100) / 100;
        updated[index].sqFt = computedSqFt;
      }
      const rate = Number(field === "rate" ? value : updated[index].rate) || 0;
      const qty = Number(field === "quantity" ? value : updated[index].quantity) || 1;
      const sq = Number(computedSqFt) || 0;

      if (sq > 0 && rate > 0) {
        updated[index].total = Math.round(sq * rate * qty * 10) / 10;
      } else if (rate > 0) {
        updated[index].total = Math.round(rate * qty);
      }
    }

    setForm({ ...form, lineItems: updated });
  };

  // Raw Material handlers for Section 4
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

  const handleRemoveRawMaterial = (index) => {
    const updated = form.rawMaterials.filter((_, i) => i !== index);
    setForm({ ...form, rawMaterials: updated });
  };

  const handleRawMaterialSelect = (index, value) => {
    const updated = [...form.rawMaterials];
    if (value === "OTHER") {
      updated[index] = {
        ...updated[index],
        productId: "OTHER",
        productCode: "",
        description: "",
        meter: "",
        sqFt: "",
        quantity: 1,
        rate: "",
        total: 0,
      };
      setForm({ ...form, rawMaterials: updated });
      return;
    }
    const product = products.find((p) => (p._id || p.id) === value);
    if (product) {
      const rate = product.pricePerMeter || product.pricePerPiece || 0;
      const m = Number(updated[index].meter) || 1;
      const qty = Number(updated[index].quantity) || 1;
      const total = Math.round(rate * m * qty);

      updated[index] = {
        ...updated[index],
        productId: product._id || product.id,
        productCode: product.productCode || "",
        description: `${product.name} ${product.productCode ? `(${product.productCode})` : ""}`.trim(),
        meter: updated[index].meter || 1,
        sqFt: updated[index].sqFt || "",
        quantity: qty,
        rate,
        total,
      };
    } else {
      updated[index] = {
        ...updated[index],
        productId: "",
        productCode: "",
        description: "",
      };
    }
    setForm({ ...form, rawMaterials: updated });
  };

  const handleRawMaterialChange = (index, field, value) => {
    const updated = [...form.rawMaterials];
    updated[index][field] = value;

    if (field === "meter" || field === "rate" || field === "quantity" || field === "sqFt") {
      const m = Number(field === "meter" ? value : updated[index].meter) || 0;
      const sq = Number(field === "sqFt" ? value : updated[index].sqFt) || 0;
      const rate = Number(field === "rate" ? value : updated[index].rate) || 0;
      const qty = Number(field === "quantity" ? value : updated[index].quantity) || 1;

      if (m > 0 && rate > 0) {
        updated[index].total = Math.round(m * rate * qty);
      } else if (sq > 0 && rate > 0) {
        updated[index].total = Math.round(sq * rate * qty);
      } else if (rate > 0) {
        updated[index].total = Math.round(rate * qty);
      }
    }

    setForm({ ...form, rawMaterials: updated });
  };

  // Distinct raw material categories from catalogue
  const distinctRawCategories = Array.from(
    new Set(
      products
        .map((p) => p.category)
        .filter(
          (c) =>
            Boolean(c) &&
            !c.toLowerCase().includes("window") &&
            !c.toLowerCase().includes("door") &&
            !c.toLowerCase().includes("hardware")
        )
    )
  ).sort();

  // Calculations for Window items
  const validWindowLines = form.lineItems.filter((it) => {
    const hasType = Boolean(it.windowType && it.windowType.trim());
    const hasDims = (Number(it.width) > 0 && Number(it.height) > 0) || Number(it.sqFt) > 0;
    const hasCost = Number(it.total || it.rate) > 0;
    return hasType || (hasDims && hasCost);
  });

  const totalSqFt = validWindowLines.reduce((acc, it) => acc + (Number(it.sqFt) || 0) * (Number(it.quantity) || 1), 0);
  const windowSubtotal = Math.round(validWindowLines.reduce((acc, it) => acc + (Number(it.total) || 0), 0));

  // Calculations for Raw Materials
  const validRawLines = (form.rawMaterials || []).filter((rm) => {
    const hasDesc = Boolean(rm.description && rm.description.trim());
    const hasMeter = Number(rm.meter) > 0 || Number(rm.sqFt) > 0;
    const hasCost = Number(rm.total || rm.rate) > 0;
    return hasDesc || hasMeter || hasCost;
  });

  const totalRawMeters = validRawLines.reduce((acc, rm) => acc + (Number(rm.meter) || 0) * (Number(rm.quantity) || 1), 0);
  const totalRawSqFt = validRawLines.reduce((acc, rm) => acc + (Number(rm.sqFt) || 0) * (Number(rm.quantity) || 1), 0);
  const totalRawQty = validRawLines.reduce((acc, rm) => acc + (Number(rm.quantity) || 1), 0);
  const rawMaterialSubtotal = Math.round(validRawLines.reduce((acc, rm) => acc + (Number(rm.total) || 0), 0));

  const grossSubtotal = windowSubtotal + rawMaterialSubtotal;
  const discountPercent = Number(form.discountPercentage) || 0;
  const discountAmount = Math.round((grossSubtotal * discountPercent) / 100);
  const taxableSubtotal = Math.max(0, grossSubtotal - discountAmount);
  const tax = Math.round(taxableSubtotal * 0.18);
  const totalAmount = taxableSubtotal + tax;

  const handleOpenPreviewFromForm = () => {
    const cust = customers.find((c) => (c._id || c.id) === form.customerId);
    const merged = {
      ...(editingInvoice || {}),
      invoiceNumber: form.invoiceNumber || editingInvoice?.invoiceNumber || "INV-DRAFT",
      quotationNumber: form.quotationNumber || editingInvoice?.quotationNumber || "",
      invoiceDate: form.invoiceDate || new Date(),
      dueDate: form.dueDate || new Date(),
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
        : editingInvoice?.customerSnapshot || {},
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
        rate: Number(it.rate) || 0,
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
      status: form.status,
      paymentStatus: form.paymentStatus,
    };
    setPreviewInvoice(merged);
  };

  const handlePreviewFromRow = (inv) => {
    let items = Array.isArray(inv.items) ? inv.items : [];
    if (typeof inv.items === "string") {
      try { items = JSON.parse(inv.items); } catch(e) {}
    }
    let rawMaterials = Array.isArray(inv.rawMaterials) ? inv.rawMaterials : [];
    if (typeof inv.rawMaterials === "string") {
      try { rawMaterials = JSON.parse(inv.rawMaterials); } catch(e) {}
    }

    setPreviewInvoice({
      ...inv,
      items,
      rawMaterials,
      companyGstin: companySettings?.gstin || (inv.companyGstin !== "23EVFPG6600A1ZB" ? inv.companyGstin : "") || inv.companyGstin || "",
    });
  };

  const handleSaveInvoice = async () => {
    if (!form.customerId) {
      message.error("Please select a customer.");
      return;
    }

    const isSettledOrPaid =
      form.paymentStatus === "settle" ||
      form.paymentStatus === "paid" ||
      form.status === "settle" ||
      form.status === "paid";

    const resolvedPaidAmount = isSettledOrPaid
      ? (Number(form.paidAmount) > 0 ? Number(form.paidAmount) : totalAmount)
      : (Number(form.paidAmount) || 0);
    const resolvedBalanceAmount = Math.max(0, totalAmount - resolvedPaidAmount);

    const payload = {
      customer: form.customerId,
      invoiceNumber: form.invoiceNumber || undefined,
      quotationNumber: form.quotationNumber || undefined,
      projectName: form.projectName,
      clientAddress: extractAddressString(form.clientAddress),
      clientCity: form.clientCity,
      clientState: form.clientState,
      clientGst: form.clientGst,
      companyGstin: form.companyGstin || companySettings?.gstin || "",
      bankDetails: form.bankDetails,
      invoiceDate: form.invoiceDate,
      dueDate: form.dueDate,
      status: form.status,
      paymentStatus: form.paymentStatus,
      paymentTerms: form.paymentTerms,
      paidAmount: resolvedPaidAmount,
      balanceAmount: resolvedBalanceAmount,
      profileSeries: form.profileSeries,
      glassType: form.glassType,
      hardware: form.hardware,
      installationIncluded: form.installationIncluded,
      specifications: {
        series: form.profileSeries,
        glass: form.glassType,
        hardware: form.hardware,
      },
      items: validWindowLines.map((it) => ({
        description: it.windowType || "Custom Window",
        windowType: it.windowType || "Custom Window",
        productCode: it.productCode || "",
        productId: it.productId || "",
        width: Number(it.width) || 0,
        height: Number(it.height) || 0,
        sqFt: Number(it.sqFt) || 0,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.rate) || 0,
        rate: Number(it.rate) || 0,
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
      grandTotal: totalAmount,
      termsAndConditions: form.termsAndConditions,
      notes: form.notes,
    };

    try {
      if (editingInvoice && (editingInvoice._id || editingInvoice.id)) {
        await invoiceAPI.update(editingInvoice._id || editingInvoice.id, payload);
        message.success("Invoice updated successfully!");
      } else {
        await invoiceAPI.create(payload);
        message.success("Invoice created successfully!");
      }
      setViewMode("list");
      setEditingInvoice(null);
      fetchInvoices();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to save invoice.");
    }
  };

  const handleSendEmail = async (inv) => {
    const custEmail = inv.customerSnapshot?.email || inv.customer?.email || "";
    const emailTo = window.prompt("Enter customer email address to send Tax Invoice:", custEmail);
    if (!emailTo) return;

    setSendingEmail(true);
    try {
      await invoiceAPI.send(inv._id || inv.id, { emailTo });
      message.success(`Invoice dispatched to ${emailTo}!`);
      fetchInvoices();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to send invoice email.");
    } finally {
      setSendingEmail(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const custName = inv.customer?.companyName || inv.customerSnapshot?.companyName || inv.customerSnapshot?.name || inv.customerName || "";
    const matches =
      custName.toLowerCase().includes(search.toLowerCase()) ||
      (inv.invoiceNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (inv.quotationNumber || "").toLowerCase().includes(search.toLowerCase());
    if (!matches) return false;
    if (statusFilter === "All statuses") return true;
    const current = (inv.paymentStatus || inv.status || "due").toLowerCase();
    const filter = statusFilter.toLowerCase();
    if (filter === "due" && (current === "due" || current === "unpaid")) return true;
    if (filter === "settle" && (current === "settle" || current === "settled" || current === "paid")) return true;
    return current === filter;
  });

  const totalBilled = invoices.reduce((acc, inv) => acc + Number(inv.totalAmount || inv.grandTotal || 0), 0);
  const totalPaid = invoices.reduce((acc, inv) => {
    const isSettled = /paid|settle/.test((inv.paymentStatus || inv.status || "").toLowerCase());
    const invTotal = Number(inv.totalAmount || inv.grandTotal || 0);
    const recordedPaid = Number(inv.paidAmount || 0);
    if (isSettled) {
      return acc + (recordedPaid > 0 ? recordedPaid : invTotal);
    }
    return acc + recordedPaid;
  }, 0);
  const totalDue = Math.max(0, totalBilled - totalPaid);

  return (
    <>
      <div className="crumb">
        DD UPVC <span style={{ margin: "0 6px" }}>/</span> INVOICES &amp; PAYMENTS
      </div>

      {viewMode === "list" ? (
        <>
          <div className="pagehead">
            <div>
              <h1>Invoices &amp; Payments</h1>
              <p>Create tax invoices, review fabrication specifications, print documents and track customer settlements.</p>
            </div>
            <div className="actions">
              <button className="btn primary" onClick={handleOpenNew} style={{ background: "#103567", borderColor: "#103567" }}>
                ＋ Create Tax Invoice
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid stats">
            <div className="card stat">
              <div className="statrow">
                <span>Invoiced Amount</span>
                <span className="staticon">▧</span>
              </div>
              <strong>₹{totalBilled.toLocaleString("en-IN")}</strong>
              <span className="trend">{invoices.length} invoices generated</span>
            </div>
            <div className="card stat">
              <div className="statrow">
                <span>Total Collected</span>
                <span className="staticon">✓</span>
              </div>
              <strong>₹{totalPaid.toLocaleString("en-IN")}</strong>
              <span className="trend" style={{ color: "var(--green)" }}>Settled collections</span>
            </div>
            <div className="card stat">
              <div className="statrow">
                <span>Receivables Due</span>
                <span className="staticon">₹</span>
              </div>
              <strong>₹{totalDue.toLocaleString("en-IN")}</strong>
              <span className="trend" style={{ color: totalDue > 0 ? "var(--amber)" : "var(--muted)" }}>Open receivables</span>
            </div>
            <div className="card stat">
              <div className="statrow">
                <span>Payment Health</span>
                <span className="staticon">◷</span>
              </div>
              <strong>{invoices.filter((i) => /paid|settle/.test((i.paymentStatus || i.status || "").toLowerCase())).length} / {invoices.length}</strong>
              <span className="trend" style={{ color: "var(--green)" }}>Fully cleared accounts</span>
            </div>
          </div>

          {/* Main Table Card */}
          <div className="card">
            <div className="cardhead">
              <h2>
                Invoices Matrix <span className="muted" style={{ fontWeight: 400 }}>({filteredInvoices.length})</span>
              </h2>
            </div>

            <div className="toolbar" style={{ padding: "14px 16px 0", marginBottom: 0 }}>
              <input
                placeholder="Search by invoice number, quote ref, customer company…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option>All statuses</option>
                <option value="due">Due</option>
                <option value="settle">Settle</option>
                <option value="partially-paid">Partially Paid</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Invoice No.</th>
                    <th>Customer</th>
                    <th>Project / Site</th>
                    <th>Invoice Date</th>
                    <th>Due Date</th>
                    <th>Total Amount</th>
                    <th>Payment Status</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length > 0 ? (
                    filteredInvoices.map((r, i) => {
                      const custCompany = r.customerSnapshot?.companyName || r.customer?.companyName || r.customerSnapshot?.name || r.customer?.name || "Client Business";
                      const custEmail = r.customerSnapshot?.email || r.customer?.email || "";
                      const hasQuoteRef = r.quotationNumber || r.quotation?.quotationNumber;

                      return (
                        <tr key={r._id || r.id || i}>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <b style={{ color: "#103567", fontSize: 13 }}>{r.invoiceNumber || `INV-${1001 + i}`}</b>
                              {hasQuoteRef && (
                                <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>
                                  Ref: {r.quotationNumber || r.quotation?.quotationNumber}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="customer">
                              <div className="miniavatar">
                                {custCompany.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <b>{custCompany}</b>
                                <small>{custEmail}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: 12, color: "#334155" }}>
                              {r.projectName || r.clientAddress || "—"}
                            </span>
                          </td>
                          <td>{dayjs(r.invoiceDate || r.createdAt).format("DD MMM YYYY")}</td>
                          <td>{r.dueDate ? dayjs(r.dueDate).format("DD MMM YYYY") : "—"}</td>
                          <td>
                            <b style={{ color: "#0f172a", fontSize: 13 }}>
                              ₹{Number(r.totalAmount || r.grandTotal || 0).toLocaleString("en-IN")}
                            </b>
                          </td>
                          <td>{statusPill(r.paymentStatus || r.status || "due")}</td>
                          <td>
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                              <button
                                className="btn"
                                style={{
                                  padding: "5px 9px",
                                  fontWeight: 600,
                                  color: "#103567",
                                  borderColor: "#bfdbfe",
                                  background: "#eff6ff",
                                  fontSize: 12,
                                }}
                                onClick={() => handleViewOrEdit(r)}
                                title="View & Edit Invoice Specification"
                              >
                                👁 View / Edit
                              </button>
                              <button
                                className="btn primary"
                                style={{
                                  padding: "5px 9px",
                                  fontWeight: 600,
                                  fontSize: 12,
                                  background: "#103567",
                                  borderColor: "#103567",
                                }}
                                onClick={() => handlePreviewFromRow(r)}
                                title="Open exact DD UPVC Printable & Downloadable Invoice Template"
                              >
                                🖨 Template
                              </button>
                              <button
                                className="btn"
                                style={{
                                  padding: "5px 9px",
                                  fontWeight: 600,
                                  color: "#166534",
                                  borderColor: "#bbf7d0",
                                  background: "#f0fdf4",
                                  fontSize: 12,
                                }}
                                onClick={() => handleSendEmail(r)}
                                title="Send Tax Invoice directly to client"
                              >
                                ✉
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
                          <b>No invoices found</b>
                          {loading ? "Loading invoices..." : "Click '+ Create Tax Invoice' or convert an approved quotation to generate one."}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "12px 16px", color: "#8390a2", fontSize: 11, borderTop: "1px solid var(--line)" }}>
              Showing {filteredInvoices.length} invoices · DD UPVC Fabrication &amp; Tax Invoice Engine
            </div>
          </div>
        </>
      ) : (
        /* Full View & Edit Invoice Form */
        <div>
          <div className="pagehead" style={{ position: "sticky", top: 0, zIndex: 10, background: "#ffffff", padding: "12px 0", borderBottom: "1px solid var(--line)", marginBottom: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  className="btn"
                  style={{ padding: "5px 10px", fontSize: 12 }}
                  onClick={() => setViewMode("list")}
                >
                  ← Back to Invoices
                </button>
                <h1 style={{ margin: 0, fontSize: 20 }}>
                  {editingInvoice ? `Invoice: ${form.invoiceNumber || editingInvoice.invoiceNumber}` : "Create New Tax Invoice"}
                </h1>
                {form.quotationNumber && (
                  <span className="pill blue" style={{ fontSize: 11 }}>
                    Converted from {form.quotationNumber}
                  </span>
                )}
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#64748b" }}>
                DD UPVC Windows &amp; Doors specification costing, Prominance profile fabrication matrix and tax billing.
              </p>
            </div>
            <div className="actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                className="btn"
                style={{ color: "#103567", borderColor: "#bfdbfe", background: "#eff6ff", fontWeight: 700 }}
                onClick={handleOpenPreviewFromForm}
                title="Preview exact printable DD UPVC Invoice template"
              >
                👁 View Invoice Template
              </button>
              {editingInvoice && (
                <button
                  className="btn"
                  style={{ color: "#166534", borderColor: "#bbf7d0", background: "#f0fdf4", fontWeight: 600 }}
                  onClick={() => handleSendEmail(editingInvoice)}
                  disabled={sendingEmail}
                >
                  ✉ Send to Client
                </button>
              )}
              <button className="btn" onClick={() => setViewMode("list")}>
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={handleSaveInvoice}
                style={{ background: "#103567", borderColor: "#103567", fontWeight: 700 }}
              >
                💾 {editingInvoice ? "Save Invoice Changes" : "Create Tax Invoice"}
              </button>
            </div>
          </div>

          {/* Section 1: Customer & Site Details Card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
              <div>
                <h3 style={{ margin: 0, color: "#103567" }}>1. Client &amp; Invoice Billing Details</h3>
                <small className="muted">Specify client account, site address, GSTIN and billing dates.</small>
              </div>
              <div>{statusPill(form.paymentStatus || form.status)}</div>
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
                  <label>Invoice Number *</label>
                  <input
                    value={form.invoiceNumber}
                    onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                    placeholder="e.g. INV-2026-0001"
                  />
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
                  <label>Payment Due Date</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Project / Site Name</label>
                  <input
                    placeholder="e.g. Commercial Complex Phase 2"
                    value={form.projectName}
                    onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Site / Street Address</label>
                  <input
                    placeholder="e.g. Kudri Road / Sector 4"
                    value={form.clientAddress}
                    onChange={(e) => setForm({ ...form, clientAddress: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>City</label>
                  <input
                    placeholder="e.g. Shahdol / Jabalpur"
                    value={form.clientCity}
                    onChange={(e) => setForm({ ...form, clientCity: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>State</label>
                  <input
                    placeholder="e.g. Madhya Pradesh"
                    value={form.clientState}
                    onChange={(e) => setForm({ ...form, clientState: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Client GSTIN</label>
                  <input
                    placeholder="e.g. 23AAAAA0000A1Z5"
                    value={form.clientGst}
                    onChange={(e) => setForm({ ...form, clientGst: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Technical Specifications Card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
              <div>
                <h3 style={{ margin: 0, color: "#103567" }}>2. Technical Specifications</h3>
                <small className="muted">Standard profile series, glass type, and hardware fittings.</small>
              </div>
            </div>
            <div className="cardbody">
              <div className="formgrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div className="field">
                  <label>Profile Series *</label>
                  <select
                    value={form.profileSeries}
                    onChange={(e) => setForm({ ...form, profileSeries: e.target.value })}
                  >
                    {SERIES_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s} Series (Prominance)
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

          {/* Section 3: Window & Door Measurement Grid */}
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
                          placeholder={item.productId === "OTHER" ? "Enter custom window / door description..." : "Window Description"}
                          value={item.windowType}
                          onChange={(e) => handleWindowFieldChange(idx, "windowType", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          style={{ width: "100%", fontSize: 12, padding: "5px 6px" }}
                          placeholder="e.g. 1200"
                          value={item.width !== undefined ? item.width : ""}
                          onChange={(e) => handleWindowFieldChange(idx, "width", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          style={{ width: "100%", fontSize: 12, padding: "5px 6px" }}
                          placeholder="e.g. 1200"
                          value={item.height !== undefined ? item.height : ""}
                          onChange={(e) => handleWindowFieldChange(idx, "height", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          style={{ width: "100%", fontSize: 12, padding: "5px 6px", background: "#f8fafc" }}
                          placeholder="Sq. Ft"
                          value={item.sqFt !== undefined ? item.sqFt : ""}
                          onChange={(e) => handleWindowFieldChange(idx, "sqFt", e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="number"
                          min="1"
                          style={{ width: "100%", minWidth: "60px", maxWidth: "75px", fontSize: 12, padding: "5px 6px", textAlign: "center", margin: "0 auto", display: "block" }}
                          placeholder="1"
                          value={item.quantity !== undefined ? item.quantity : 1}
                          onChange={(e) => handleWindowFieldChange(idx, "quantity", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          style={{ width: "100%", fontSize: 12, padding: "5px 6px" }}
                          placeholder="Rate ₹"
                          value={item.rate !== undefined ? item.rate : ""}
                          onChange={(e) => handleWindowFieldChange(idx, "rate", e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#103567", fontSize: 13, padding: "5px 8px" }}>
                        ₹{Number(item.total || 0).toLocaleString("en-IN")}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="btn"
                          style={{ padding: "3px 8px", color: "var(--red)", borderColor: "transparent", background: "#fee2e2" }}
                          onClick={() => handleRemoveLine(idx)}
                          disabled={form.lineItems.length === 1}
                          title="Remove row"
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

          {/* Section 4: Raw Materials Grid */}
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
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="number"
                            min="1"
                            style={{ width: "100%", minWidth: "60px", maxWidth: "75px", fontSize: 12, padding: "5px 6px", textAlign: "center", margin: "0 auto", display: "block" }}
                            placeholder="1"
                            value={rm.quantity !== undefined ? rm.quantity : 1}
                            onChange={(e) => handleRawMaterialChange(idx, "quantity", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            style={{ width: "100%", fontSize: 12, padding: "5px 6px" }}
                            placeholder="Rate ₹"
                            value={rm.rate !== undefined ? rm.rate : ""}
                            onChange={(e) => handleRawMaterialChange(idx, "rate", e.target.value)}
                          />
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "#103567", fontSize: 13, padding: "5px 8px" }}>
                          ₹{Number(rm.total || 0).toLocaleString("en-IN")}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            className="btn"
                            style={{ padding: "3px 8px", color: "var(--red)", borderColor: "transparent", background: "#fee2e2" }}
                            onClick={() => handleRemoveRawMaterial(idx)}
                            title="Remove row"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "16px", color: "#64748b" }}>
                        No raw materials added yet. Click <b>"＋ Add Raw Material"</b> above if this invoice includes separate profile raw materials.
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
                <h3 style={{ margin: 0, color: "#103567" }}>5. Bank Details &amp; Company GSTIN (Printed on Tax Invoice)</h3>
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
                  <label>Branch Name &amp; Address</label>
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
              </div>
            </div>
          </div>

          {/* Section 6: Commercial Terms & Costing Summary */}
          <div className="grid cols-2" style={{ marginBottom: 30 }}>
            <div className="card">
              <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
                <h3 style={{ margin: 0, color: "#103567" }}>6. Terms, Settlement &amp; Payment Status</h3>
              </div>
              <div className="cardbody">
                <div className="formgrid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 12 }}>
                  <div className="field">
                    <label>Payment Status</label>
                    <select
                      value={form.paymentStatus}
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        const isSettleOrPaid = newStatus === "settle" || newStatus === "paid";
                        setForm((prev) => ({
                          ...prev,
                          paymentStatus: newStatus,
                          status: newStatus,
                          paidAmount: isSettleOrPaid
                            ? (Number(prev.paidAmount) > 0 ? prev.paidAmount : totalAmount)
                            : (newStatus === "due" && Number(prev.paidAmount) === totalAmount ? 0 : prev.paidAmount),
                        }));
                      }}
                    >
                      <option value="due">Due</option>
                      <option value="settle">Settle</option>
                      <option value="partially-paid">Partially Paid</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Amount Already Paid (₹)</label>
                    <input
                      type="number"
                      value={form.paidAmount !== undefined ? form.paidAmount : ""}
                      onChange={(e) => setForm({ ...form, paidAmount: Number(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Commercial &amp; Warranty Terms</label>
                  <textarea
                    rows={5}
                    value={form.termsAndConditions}
                    onChange={(e) => setForm({ ...form, termsAndConditions: e.target.value })}
                    placeholder="Terms and conditions for payment, dispatch, warranty, and liability..."
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="cardhead" style={{ borderBottom: "1px solid var(--line)" }}>
                <h3 style={{ margin: 0, color: "#103567" }}>7. Tax Invoice Cost Summary</h3>
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
                  <span>Total Invoice Amount:</span>
                  <strong style={{ color: "#103567" }}>₹{totalAmount.toLocaleString("en-IN")}</strong>
                </div>

                {Number(form.paidAmount) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 13, color: "var(--green)" }}>
                    <span>Amount Paid:</span>
                    <b>₹{Number(form.paidAmount).toLocaleString("en-IN")}</b>
                  </div>
                )}
                {Number(form.paidAmount) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 14, color: "var(--amber)", fontWeight: 700 }}>
                    <span>Balance Due:</span>
                    <b>₹{Math.max(0, totalAmount - Number(form.paidAmount)).toLocaleString("en-IN")}</b>
                  </div>
                )}
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
              ← Back to Invoices List
            </button>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn"
                style={{ color: "#103567", borderColor: "#bfdbfe", background: "#eff6ff", fontWeight: 700 }}
                onClick={handleOpenPreviewFromForm}
              >
                👁 View Invoice Template
              </button>
              <button
                className="btn primary"
                onClick={handleSaveInvoice}
                style={{ background: "#103567", borderColor: "#103567", fontWeight: 700 }}
              >
                💾 {editingInvoice ? "Save Invoice Changes" : "Create Tax Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Abhishek Jain DD UPVC Tax Invoice Template Preview & Print/Email Modal */}
      {previewInvoice && (
        <ProformaInvoiceTemplate
          invoice={previewInvoice}
          quotation={previewInvoice}
          type="invoice"
          settings={companySettings}
          onClose={() => setPreviewInvoice(null)}
          onRefresh={fetchInvoices}
        />
      )}
    </>
  );
}
