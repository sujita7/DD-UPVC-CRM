import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { Expense } from "../models/index.js";

const router = Router();

// GET /api/expenses - List all expenses with stats
router.get("/api/expenses", requireAuth, async (req, res, next) => {
  try {
    const { search, category, startDate, endDate } = req.query;

    const query = {};
    if (category && category !== "All") {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { expenseId: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { paymentMethod: { $regex: search, $options: "i" } },
        { paidTo: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }

    if (startDate || endDate) {
      query.expenseDate = {};
      if (startDate) query.expenseDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.expenseDate.$lte = end;
      }
    }

    const expenses = await Expense.find(query).sort({ expenseDate: -1, createdAt: -1 }).lean();

    // Calculate live financial statistics
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const todayStr = now.toISOString().slice(0, 10);

    let totalAmount = 0;
    let thisMonthAmount = 0;
    let todayAmount = 0;

    expenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      totalAmount += amt;

      if (exp.expenseDate) {
        const d = new Date(exp.expenseDate);
        if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
          thisMonthAmount += amt;
        }
        const dStr = d.toISOString().slice(0, 10);
        if (dStr === todayStr) {
          todayAmount += amt;
        }
      }
    });

    return res.json({
      ok: true,
      expenses,
      stats: {
        totalAmount,
        thisMonthAmount,
        todayAmount,
        count: expenses.length,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/expenses/:id - Single expense details
router.get("/api/expenses/:id", requireAuth, async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id).lean();
    if (!expense) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Expense record not found." });
    }
    return res.json({ ok: true, expense });
  } catch (error) {
    return next(error);
  }
});

// POST /api/expenses - Create new expense
router.post("/api/expenses", requireAuth, async (req, res, next) => {
  try {
    const { title, amount, expenseDate, category, paymentMethod, paidTo, notes, receipt } = req.body || {};

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Expense name/title is required." });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Valid expense price/amount is required." });
    }

    const count = await Expense.countDocuments();
    const year = new Date().getFullYear();
    const expenseId = `EXP-${year}-${String(count + 1).padStart(4, "0")}`;

    const parsedDate = expenseDate ? new Date(expenseDate) : new Date();

    const expense = new Expense({
      expenseId,
      title: title.trim(),
      amount: numAmount,
      expenseDate: parsedDate,
      category: category || "General",
      paymentMethod: paymentMethod || "Cash",
      paidTo: paidTo ? paidTo.trim() : "",
      notes: notes ? notes.trim() : "",
      receipt: receipt || "",
      createdBy: req.admin?._id || null,
    });

    await expense.save();

    return res.status(201).json({
      ok: true,
      message: "Expense recorded successfully.",
      expense,
    });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/expenses/:id - Update expense
router.put("/api/expenses/:id", requireAuth, async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Expense record not found." });
    }

    const { title, amount, expenseDate, category, paymentMethod, paidTo, notes, receipt } = req.body || {};

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: "Expense name cannot be empty." });
      }
      expense.title = title.trim();
    }

    if (amount !== undefined) {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount < 0) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: "Valid expense price/amount is required." });
      }
      expense.amount = numAmount;
    }

    if (expenseDate !== undefined) {
      expense.expenseDate = new Date(expenseDate);
    }

    if (category !== undefined) expense.category = category;
    if (paymentMethod !== undefined) expense.paymentMethod = paymentMethod;
    if (paidTo !== undefined) expense.paidTo = paidTo.trim();
    if (notes !== undefined) expense.notes = notes.trim();
    if (receipt !== undefined) expense.receipt = receipt;

    await expense.save();

    return res.json({
      ok: true,
      message: "Expense updated successfully.",
      expense,
    });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/expenses/:id - Delete expense
router.delete("/api/expenses/:id", requireAuth, async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Expense record not found." });
    }

    await Expense.findByIdAndDelete(req.params.id);

    return res.json({
      ok: true,
      message: "Expense deleted successfully.",
    });
  } catch (error) {
    return next(error);
  }
});

export default router;

