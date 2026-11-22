import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { Payment, Customer, Supplier, Employee } from "../models/index.js";

const router = Router();

// GET /api/payments
router.get("/api/payments", requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, paymentType, partyType, status, startDate, endDate, search } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (paymentType) filter.paymentType = paymentType;
    if (partyType) filter.partyType = partyType;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { paymentId: { $regex: search, $options: "i" } },
        { partyName: { $regex: search, $options: "i" } },
        { paymentReference: { $regex: search, $options: "i" } },
      ];
    }
    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.paymentDate.$lte = end;
      }
    }

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .sort({ paymentDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("customer", "name companyName customerId")
        .populate("supplier", "name companyName supplierId")
        .populate("employee", "employeeId firstName lastName")
        .lean(),
      Payment.countDocuments(filter),
    ]);

    // Summary
    const summary = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$paymentType",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    return res.json({
      ok: true,
      payments,
      summary,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/payments/:id
router.get("/api/payments/:id", requireAuth, async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("customer", "name companyName email phone gstNumber")
      .populate("supplier", "name companyName email phone gstNumber")
      .populate("employee", "employeeId firstName lastName department")
      .populate("createdBy", "name email")
      .lean();
    if (!payment) return res.status(404).json({ error: "NOT_FOUND", message: "Payment not found." });
    return res.json({ ok: true, payment });
  } catch (error) {
    return next(error);
  }
});

// POST /api/payments
router.post("/api/payments", requireAuth, async (req, res, next) => {
  try {
    const { paymentType, partyType, customer, supplier, employee, partyName, amount, ...rest } = req.body || {};

    if (!paymentType || !partyType || !amount) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Payment type, party type, and amount are required." });
    }

    // Resolve party name if not provided
    let resolvedPartyName = partyName;
    if (!resolvedPartyName) {
      if (partyType === "customer" && customer) {
        const c = await Customer.findById(customer).select("name companyName").lean();
        resolvedPartyName = c?.companyName || c?.name || "Unknown Customer";
      } else if (partyType === "supplier" && supplier) {
        const s = await Supplier.findById(supplier).select("name companyName").lean();
        resolvedPartyName = s?.companyName || s?.name || "Unknown Supplier";
      } else if (partyType === "employee" && employee) {
        const e = await Employee.findById(employee).select("firstName lastName").lean();
        resolvedPartyName = e ? `${e.firstName} ${e.lastName}` : "Unknown Employee";
      }
    }

    const payment = new Payment({
      paymentType,
      partyType,
      ...(customer && { customer }),
      ...(supplier && { supplier }),
      ...(employee && { employee }),
      partyName: resolvedPartyName || "Unknown",
      amount,
      createdBy: req.admin._id,
      ...rest,
    });

    await payment.save();

    // Update financial summary for the party
    if (partyType === "customer" && customer) {
      const total = await Payment.aggregate([
        { $match: { customer: payment.customer, status: "completed", paymentType: "received" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      await Customer.findByIdAndUpdate(customer, {
        $set: {
          "financial.totalPaid": total[0]?.total || 0,
          "financial.lastPaymentDate": payment.paymentDate,
          "financial.lastPaymentAmount": amount,
        },
        $inc: { "financial.totalPaid": 0 }, // trigger update
      });
    }

    if (partyType === "supplier" && supplier) {
      await Supplier.findByIdAndUpdate(supplier, {
        $set: {
          "financial.lastPaymentDate": payment.paymentDate,
          "financial.lastPaymentAmount": amount,
        },
        $inc: { "financial.totalPaid": amount },
      });
    }

    return res.status(201).json({ ok: true, payment });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/payments/:id
router.put("/api/payments/:id", requireAuth, async (req, res, next) => {
  try {
    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).lean();
    if (!payment) return res.status(404).json({ error: "NOT_FOUND", message: "Payment not found." });
    return res.json({ ok: true, payment });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/payments/:id
router.delete("/api/payments/:id", requireAuth, async (req, res, next) => {
  try {
    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "cancelled" } },
      { new: true }
    ).lean();
    if (!payment) return res.status(404).json({ error: "NOT_FOUND", message: "Payment not found." });
    return res.json({ ok: true, message: "Payment cancelled.", payment });
  } catch (error) {
    return next(error);
  }
});

// GET /api/payments/stats/summary - Payment stats
router.get("/api/payments/stats/summary", requireAuth, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }

    const matchFilter = { status: "completed" };
    if (Object.keys(dateFilter).length) matchFilter.paymentDate = dateFilter;

    const stats = await Payment.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$paymentType",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    let totalCustomerReceived = 0;
    let totalSupplierPaid = 0;
    let totalPayrollPaid = 0;

    stats.forEach((s) => {
      if (s._id === "customer_received" || s._id === "received") totalCustomerReceived += s.total || 0;
      else if (s._id === "supplier_paid" || s._id === "made") totalSupplierPaid += s.total || 0;
      else if (s._id === "payroll_paid" || s._id === "payroll") totalPayrollPaid += s.total || 0;
    });

    return res.json({
      ok: true,
      stats,
      data: {
        totalCustomerReceived,
        totalSupplierPaid,
        totalPayrollPaid,
      },
      totalCustomerReceived,
      totalSupplierPaid,
      totalPayrollPaid,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
