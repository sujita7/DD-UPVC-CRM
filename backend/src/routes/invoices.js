import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { Invoice, Customer, Payment } from "../models/index.js";

const router = Router();

// GET /api/invoices
router.get("/api/invoices", requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 100, paymentStatus, status, customer, search, startDate, endDate, invoiceType } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (invoiceType) filter.invoiceType = invoiceType;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (status) filter.status = status;
    if (customer) filter.customer = customer;
    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { "customerSnapshot.name": { $regex: search, $options: "i" } },
        { "customerSnapshot.companyName": { $regex: search, $options: "i" } },
      ];
    }
    if (startDate || endDate) {
      filter.invoiceDate = {};
      if (startDate) filter.invoiceDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.invoiceDate.$lte = end;
      }
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .sort({ invoiceDate: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("customer", "name companyName email phone customerId")
        .select("-lineItems")
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    // Financial summary
    const summary = await Invoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$paymentStatus",
          total: { $sum: "$grandTotal" },
          count: { $sum: 1 },
        },
      },
    ]);

    return res.json({
      ok: true,
      invoices,
      summary,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/invoices/:id
router.get("/api/invoices/:id", requireAuth, async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate("customer", "name companyName email phone gstNumber panNumber billingAddress")
      .populate("createdBy", "name email")
      .populate("quotation", "quotationNumber")
      .lean();
    if (!invoice) return res.status(404).json({ error: "NOT_FOUND", message: "Invoice not found." });
    return res.json({ ok: true, invoice });
  } catch (error) {
    return next(error);
  }
});

// POST /api/invoices
router.post("/api/invoices", requireAuth, async (req, res, next) => {
  try {
    const { customer: customerId, ...rest } = req.body || {};

    if (!customerId) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Customer is required." });
    }

    const customer = await Customer.findById(customerId).lean();
    if (!customer) return res.status(404).json({ error: "NOT_FOUND", message: "Customer not found." });

    const count = await Invoice.countDocuments();
    const prefix = rest.invoiceType === "proforma" ? "PI" : "INV";
    const invoiceNumber = rest.invoiceNumber || `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const invoice = new Invoice({
      invoiceNumber,
      invoiceType: rest.invoiceType || "tax-invoice",
      customer: customerId,
      customerSnapshot: {
        name: customer.name,
        companyName: customer.companyName,
        email: customer.email,
        phone: customer.phone,
        gstNumber: customer.gstNumber,
        panNumber: customer.panNumber,
        billingAddress: customer.billingAddress,
      },
      invoiceDate: rest.invoiceDate ? new Date(rest.invoiceDate) : new Date(),
      dueDate: rest.dueDate ? new Date(rest.dueDate) : new Date(Date.now() + 30 * 86400000),
      createdBy: req.admin._id,
      ...rest,
    });

    await invoice.save();

    // Update customer's total invoiced
    await Customer.findByIdAndUpdate(customerId, {
      $inc: { "financial.totalInvoiced": invoice.grandTotal },
    });

    return res.status(201).json({ ok: true, invoice });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/invoices/:id
router.put("/api/invoices/:id", requireAuth, async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: "NOT_FOUND", message: "Invoice not found." });

    if (invoice.paymentStatus === "paid") {
      return res.status(403).json({ error: "FORBIDDEN", message: "Cannot modify a fully paid invoice." });
    }

    Object.assign(invoice, req.body);
    await invoice.save();

    return res.json({ ok: true, invoice });
  } catch (error) {
    return next(error);
  }
});

// POST /api/invoices/:id/record-payment - Record payment against invoice
router.post("/api/invoices/:id/record-payment", requireAuth, async (req, res, next) => {
  try {
    const { amount, paymentMethod, paymentDate, paymentReference, notes } = req.body || {};

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Valid payment amount is required." });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: "NOT_FOUND", message: "Invoice not found." });

    if (invoice.paymentStatus === "paid") {
      return res.status(409).json({ error: "CONFLICT", message: "Invoice is already fully paid." });
    }

    // Create payment record
    const payment = new Payment({
      paymentType: "received",
      partyType: "customer",
      customer: invoice.customer,
      partyName: invoice.customerSnapshot?.companyName || invoice.customerSnapshot?.name || "Customer",
      amount,
      paymentMethod,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentReference,
      notes,
      invoice: invoice._id,
      status: "completed",
      createdBy: req.admin._id,
    });

    await payment.save();

    // Update invoice
    invoice.amountPaid = (invoice.amountPaid || 0) + amount;
    invoice.payments.push(payment._id);
    await invoice.save();

    return res.json({ ok: true, message: "Payment recorded.", payment, invoice });
  } catch (error) {
    return next(error);
  }
});

// POST /api/invoices/:id/send - Mark invoice as sent
router.post("/api/invoices/:id/send", requireAuth, async (req, res, next) => {
  try {
    const { emailTo } = req.body || {};
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: "sent",
          ...(emailTo && { emailSentTo: emailTo, emailSentAt: new Date() }),
        },
      },
      { new: true }
    );
    if (!invoice) return res.status(404).json({ error: "NOT_FOUND", message: "Invoice not found." });
    return res.json({ ok: true, message: "Invoice marked as sent.", invoice });
  } catch (error) {
    return next(error);
  }
});

// POST /api/invoices/:id/cancel
router.post("/api/invoices/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: "NOT_FOUND", message: "Invoice not found." });

    if (invoice.paymentStatus === "paid") {
      return res.status(403).json({ error: "FORBIDDEN", message: "Cannot cancel a paid invoice." });
    }

    invoice.status = "cancelled";
    invoice.paymentStatus = "cancelled";
    await invoice.save();

    return res.json({ ok: true, message: "Invoice cancelled.", invoice });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/invoices/:id - Delete draft invoice
router.delete("/api/invoices/:id", requireAuth, async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: "NOT_FOUND", message: "Invoice not found." });

    if (invoice.status !== "draft") {
      return res.status(403).json({ error: "FORBIDDEN", message: "Only draft invoices can be deleted." });
    }

    await invoice.deleteOne();
    return res.json({ ok: true, message: "Invoice deleted." });
  } catch (error) {
    return next(error);
  }
});

export default router;
