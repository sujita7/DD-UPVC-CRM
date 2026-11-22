import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { Holiday } from "../models/index.js";

const router = Router();

// GET /api/holidays - List holidays (optionally filter by month & year)
router.get("/api/holidays", requireAuth, async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const filter = {};

    if (month && year) {
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 1);
      filter.date = { $gte: start, $lt: end };
    } else if (year) {
      const start = new Date(Number(year), 0, 1);
      const end = new Date(Number(year) + 1, 0, 1);
      filter.date = { $gte: start, $lt: end };
    }

    const holidays = await Holiday.find(filter).sort({ date: 1 }).lean();
    return res.json({ ok: true, holidays });
  } catch (error) {
    return next(error);
  }
});

// POST /api/holidays - Create holiday manually
router.post("/api/holidays", requireAuth, async (req, res, next) => {
  try {
    const { name, date, description, isOptional } = req.body || {};
    if (!name || !date) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Name and date are required." });
    }

    const holidayDate = new Date(date);
    holidayDate.setHours(0, 0, 0, 0);

    const existing = await Holiday.findOne({ date: holidayDate });
    if (existing) {
      return res.status(409).json({ error: "CONFLICT", message: "A holiday already exists on this date." });
    }

    const holiday = new Holiday({
      name,
      date: holidayDate,
      description,
      isOptional: !!isOptional,
      createdBy: req.admin?._id,
    });

    await holiday.save();
    return res.status(201).json({ ok: true, holiday });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/holidays/:id - Delete a holiday
router.delete("/api/holidays/:id", requireAuth, async (req, res, next) => {
  try {
    const holiday = await Holiday.findByIdAndDelete(req.params.id).lean();
    if (!holiday) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Holiday not found." });
    }
    return res.json({ ok: true, message: "Holiday removed successfully." });
  } catch (error) {
    return next(error);
  }
});

export default router;

