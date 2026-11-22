import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { AdvancePayment, Employee } from "../models/index.js";

const router = Router();

// GET /api/advance-payments - List all employee advance payments
router.get("/api/advance-payments", requireAuth, async (req, res, next) => {
  try {
    const { employee, month, year, status, search } = req.query;

    const query = {};
    if (employee) query.employee = employee;
    if (status && status !== "All") query.status = status;
    if (month && month !== "All") query.month = Number(month);
    if (year && year !== "All") query.year = Number(year);

    if (search) {
      query.$or = [
        { employeeName: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
        { advanceId: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
        { paymentMethod: { $regex: search, $options: "i" } },
      ];
    }

    const advances = await AdvancePayment.find(query)
      .sort({ paymentDate: -1, createdAt: -1 })
      .populate("employee", "firstName lastName employeeId department designation salary phone bankDetails")
      .lean();

    // Compute live stats
    let totalAmount = 0;
    let pendingAmount = 0;
    let deductedAmount = 0;

    advances.forEach((adv) => {
      const amt = Number(adv.amount) || 0;
      totalAmount += amt;
      if (adv.status === "deducted") {
        deductedAmount += amt;
      } else {
        pendingAmount += amt;
      }
    });

    return res.json({
      ok: true,
      advances,
      stats: {
        totalAmount,
        pendingAmount,
        deductedAmount,
        count: advances.length,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/advance-payments/:id - Get single record
router.get("/api/advance-payments/:id", requireAuth, async (req, res, next) => {
  try {
    const advance = await AdvancePayment.findById(req.params.id)
      .populate("employee", "firstName lastName employeeId department designation salary")
      .lean();
    if (!advance) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Advance payment record not found." });
    }
    return res.json({ ok: true, advance });
  } catch (error) {
    return next(error);
  }
});

// POST /api/advance-payments - Create advance payment record
router.post("/api/advance-payments", requireAuth, async (req, res, next) => {
  try {
    const { employee: empId, amount, paymentDate, month, year, paymentMethod, notes } = req.body || {};

    if (!empId) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Please select an employee." });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Please enter a valid advance amount." });
    }

    const emp = await Employee.findById(empId).lean();
    if (!emp) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Employee not found." });
    }

    const parsedDate = paymentDate ? new Date(paymentDate) : new Date();
    const targetMonth = month ? Number(month) : (parsedDate.getMonth() + 1);
    const targetYear = year ? Number(year) : parsedDate.getFullYear();

    const count = await AdvancePayment.countDocuments();
    const advanceId = `ADV-${targetYear}-${String(count + 1).padStart(4, "0")}`;

    const advance = new AdvancePayment({
      advanceId,
      employee: empId,
      employeeId: emp.employeeId || "EMP-001",
      employeeName: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.name,
      amount: numAmount,
      paymentDate: parsedDate,
      month: targetMonth,
      year: targetYear,
      paymentMethod: paymentMethod || "Cash",
      notes: notes ? notes.trim() : "",
      status: "pending",
      createdBy: req.admin?._id || null,
    });

    await advance.save();

    return res.status(201).json({
      ok: true,
      message: `Advance payment of ₹${numAmount.toLocaleString("en-IN")} recorded for ${advance.employeeName}.`,
      advance,
    });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/advance-payments/:id - Update advance payment
router.put("/api/advance-payments/:id", requireAuth, async (req, res, next) => {
  try {
    const advance = await AdvancePayment.findById(req.params.id);
    if (!advance) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Advance payment record not found." });
    }

    const { employee: empId, amount, paymentDate, month, year, paymentMethod, notes, status } = req.body || {};

    if (empId) {
      const emp = await Employee.findById(empId).lean();
      if (emp) {
        advance.employee = empId;
        advance.employeeId = emp.employeeId || advance.employeeId;
        advance.employeeName = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || advance.employeeName;
      }
    }

    if (amount !== undefined) {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: "Please enter a valid advance amount." });
      }
      advance.amount = numAmount;
    }

    if (paymentDate) {
      advance.paymentDate = new Date(paymentDate);
    }
    if (month) advance.month = Number(month);
    if (year) advance.year = Number(year);
    if (paymentMethod) advance.paymentMethod = paymentMethod;
    if (notes !== undefined) advance.notes = notes.trim();
    if (status) advance.status = status;

    await advance.save();

    return res.json({
      ok: true,
      message: "Advance payment updated successfully.",
      advance,
    });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/advance-payments/:id - Delete advance payment
router.delete("/api/advance-payments/:id", requireAuth, async (req, res, next) => {
  try {
    const advance = await AdvancePayment.findById(req.params.id);
    if (!advance) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Advance payment record not found." });
    }

    await AdvancePayment.findByIdAndDelete(req.params.id);

    return res.json({
      ok: true,
      message: "Advance payment record deleted successfully.",
    });
  } catch (error) {
    return next(error);
  }
});

export default router;

