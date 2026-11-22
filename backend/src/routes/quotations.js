import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { Quotation, Customer, Invoice, CompanySettings } from "../models/index.js";
import { sendQuotationEmail } from "../services/emailService.js";

const router = Router();

// GET /api/quotations
router.get("/api/quotations", requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, customer, search, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;
    if (customer) filter.customer = customer;
    if (search) {
      filter.$or = [
        { quotationNumber: { $regex: search, $options: "i" } },
        { "customerSnapshot.name": { $regex: search, $options: "i" } },
        { "customerSnapshot.companyName": { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
      ];
    }
    if (startDate || endDate) {
      filter.quotationDate = {};
      if (startDate) filter.quotationDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.quotationDate.$lte = end;
      }
    }

    const [quotations, total] = await Promise.all([
      Quotation.find(filter)
        .sort({ quotationDate: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("customer", "name companyName email phone customerId")
        .select("-lineItems")
        .lean(),
      Quotation.countDocuments(filter),
    ]);

    return res.json({
      ok: true,
      quotations,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/quotations/:id
router.get("/api/quotations/:id", requireAuth, async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate("customer", "name companyName email phone gstNumber billingAddress")
      .populate("createdBy", "name email")
      .populate("invoice", "invoiceNumber")
      .lean();
    if (!quotation) return res.status(404).json({ error: "NOT_FOUND", message: "Quotation not found." });
    return res.json({ ok: true, quotation });
  } catch (error) {
    return next(error);
  }
});

// POST /api/quotations
router.post("/api/quotations", requireAuth, async (req, res, next) => {
  try {
    const { customer: customerId, ...rest } = req.body || {};

    if (!customerId) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Customer is required." });
    }

    const customer = await Customer.findById(customerId).lean();
    if (!customer) return res.status(404).json({ error: "NOT_FOUND", message: "Customer not found." });

    const count = await Quotation.countDocuments();
    const quotationNumber = rest.quotationNumber || `QT-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const quotation = new Quotation({
      quotationNumber,
      customer: customerId,
      customerSnapshot: {
        name: customer.name,
        companyName: customer.companyName,
        email: customer.email,
        phone: customer.phone,
        gstNumber: customer.gstNumber,
        billingAddress: customer.billingAddress,
      },
      quotationDate: rest.quotationDate ? new Date(rest.quotationDate) : new Date(),
      validUntil: rest.validUntil ? new Date(rest.validUntil) : new Date(Date.now() + 30 * 86400000),
      createdBy: req.admin._id,
      ...rest,
    });

    await quotation.save();
    return res.status(201).json({ ok: true, quotation });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/quotations/:id
router.put("/api/quotations/:id", requireAuth, async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) return res.status(404).json({ error: "NOT_FOUND", message: "Quotation not found." });

    if (quotation.status === "converted") {
      return res.status(403).json({ error: "FORBIDDEN", message: "Cannot modify a converted quotation." });
    }

    Object.assign(quotation, req.body);
    await quotation.save();

    return res.json({ ok: true, quotation });
  } catch (error) {
    return next(error);
  }
});

// POST /api/quotations/:id/convert-to-invoice - Convert quotation to invoice
router.post("/api/quotations/:id/convert-to-invoice", requireAuth, async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id).lean();
    if (!quotation) return res.status(404).json({ error: "NOT_FOUND", message: "Quotation not found." });

    if (quotation.status === "converted") {
      return res.status(409).json({
        error: "CONFLICT",
        message: "Quotation already converted to invoice.",
        invoiceId: quotation.invoice,
      });
    }

    const { dueDate, ...overrides } = req.body || {};

    const customer = await Customer.findById(quotation.customer).lean();

    // Fetch company settings for invoice prefix and default bank
    let companySettings = null;
    try {
      const sList = await CompanySettings.find({}).lean();
      if (sList && sList.length > 0) companySettings = sList[0];
    } catch (e) {}

    const invPrefix = companySettings?.invoicePrefix || "INV-";
    const count = await Invoice.countDocuments();
    const invoiceNumber = overrides.invoiceNumber || `${invPrefix}${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    // Normalize window items
    const rawItems = quotation.items || quotation.lineItems || [];
    const items = rawItems.map((it) => ({
      description: it.description || it.windowType || "Custom Window",
      windowType: it.windowType || it.description || "",
      productCode: it.productCode || "",
      productId: it.productId || "",
      width: Number(it.width) || 0,
      height: Number(it.height) || 0,
      sqFt: Number(it.sqFt) || 0,
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice || it.rate) || 0,
      rate: Number(it.rate || it.unitPrice) || 0,
      total: Number(it.total || it.amount) || 0,
      amount: Number(it.amount || it.total) || 0,
    }));

    let rawMaterials = quotation.rawMaterials || [];
    if (typeof rawMaterials === "string") {
      try {
        rawMaterials = JSON.parse(rawMaterials);
      } catch (e) {
        rawMaterials = [];
      }
    }

    let defaultBank = quotation.bankDetails;
    if (!defaultBank && companySettings?.bankDetails) {
      let bList = companySettings.bankDetails;
      if (typeof bList === "string") {
        try { bList = JSON.parse(bList); } catch (e) { bList = []; }
      }
      if (Array.isArray(bList)) {
        defaultBank = bList.find((b) => b.isDefault) || bList[0] || null;
      }
    }

    const totalAmt = Number(quotation.totalAmount || quotation.grandTotal) || 0;

    const invoice = new Invoice({
      invoiceNumber,
      invoiceType: "tax-invoice",
      customer: quotation.customer,
      customerSnapshot: quotation.customerSnapshot || (customer ? {
        name: customer.name,
        companyName: customer.companyName,
        email: customer.email,
        phone: customer.phone,
        gstNumber: customer.gstNumber,
        panNumber: customer.panNumber,
        billingAddress: customer.billingAddress,
      } : {}),
      quotation: quotation._id,
      quotationNumber: quotation.quotationNumber,
      projectName: quotation.projectName,
      clientAddress: quotation.clientAddress,
      clientCity: quotation.clientCity,
      clientState: quotation.clientState,
      clientGst: quotation.clientGst,
      companyGstin: quotation.companyGstin || companySettings?.gstin || "",
      bankDetails: defaultBank,
      profileSeries: quotation.profileSeries || "INVENTA",
      glassType: quotation.glassType || "",
      hardware: quotation.hardware || "",
      installationIncluded: quotation.installationIncluded !== undefined ? quotation.installationIncluded : true,
      specifications: quotation.specifications,
      items,
      rawMaterials,
      subtotal: Number(quotation.subtotal) || 0,
      discountPercentage: Number(quotation.discountPercentage) || 0,
      discountAmount: Number(quotation.discountAmount) || 0,
      taxAmount: Number(quotation.taxAmount) || 0,
      totalAmount: totalAmt,
      grandTotal: totalAmt,
      balanceAmount: totalAmt,
      paidAmount: 0,
      status: "unpaid",
      paymentStatus: "unpaid",
      termsAndConditions: quotation.termsAndConditions,
      notes: quotation.notes,
      paymentTerms: quotation.paymentTerms || "net-30",
      invoiceDate: new Date(),
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdBy: req.admin?._id || null,
      ...overrides,
    });

    await invoice.save();

    // Mark quotation as converted
    await Quotation.findByIdAndUpdate(quotation._id, {
      $set: {
        status: "converted",
        invoice: invoice._id,
        convertedAt: new Date(),
      },
    });

    // Update customer financial
    if (quotation.customer) {
      await Customer.findByIdAndUpdate(quotation.customer, {
        $inc: { "financial.totalInvoiced": totalAmt },
      });
    }

    return res.status(201).json({ ok: true, message: "Quotation converted to invoice.", invoice, quotation });
  } catch (error) {
    return next(error);
  }
});

// POST /api/quotations/:id/send
router.post("/api/quotations/:id/send", requireAuth, async (req, res, next) => {
  try {
    const { emailTo } = req.body || {};
    const quotation = await Quotation.findById(req.params.id)
      .populate("customer", "name companyName email phone gstNumber billingAddress")
      .lean();
    if (!quotation) return res.status(404).json({ error: "NOT_FOUND", message: "Quotation not found." });

    const recipient = emailTo || quotation.customerSnapshot?.email || quotation.customer?.email;
    if (!recipient) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Customer email address is required to send quotation." });
    }

    const emailResult = await sendQuotationEmail({
      emailTo: recipient,
      quotation,
      customer: quotation.customerSnapshot || quotation.customer,
    });

    const updated = await Quotation.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: "sent",
          emailSentTo: recipient,
          emailSentAt: new Date(),
        },
      },
      { new: true }
    );

    return res.json({
      ok: true,
      message: emailResult.sent
        ? `Quotation sent successfully to ${recipient}`
        : `Quotation marked as sent to ${recipient} (Email notification: ${emailResult.error || emailResult.reason || "SMTP check required"}).`,
      emailResult,
      quotation: updated,
    });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/quotations/:id
router.delete("/api/quotations/:id", requireAuth, async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) return res.status(404).json({ error: "NOT_FOUND", message: "Quotation not found." });

    if (quotation.status === "converted") {
      return res.status(403).json({ error: "FORBIDDEN", message: "Cannot delete a converted quotation." });
    }

    await quotation.deleteOne();
    return res.json({ ok: true, message: "Quotation deleted." });
  } catch (error) {
    return next(error);
  }
});

export default router;
