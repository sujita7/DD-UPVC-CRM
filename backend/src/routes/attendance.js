import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { Attendance, Employee } from "../models/index.js";

const router = Router();

// GET /api/attendance - List attendance records
router.get("/api/attendance", requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 50, employee, date, startDate, endDate, month, year, status } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (employee) filter.employee = employee;
    if (status) filter.status = status;

    // Date filtering
    if (startDate && endDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      filter.date = { $gte: s, $lte: e };
    } else if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      filter.date = { $gte: d, $lt: next };
    } else if (month && year) {
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    const [records, total] = await Promise.all([
      Attendance.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("employee", "employeeId firstName lastName department designation")
        .lean(),
      Attendance.countDocuments(filter),
    ]);

    return res.json({
      ok: true,
      attendance: records,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/attendance/summary/:employeeId - Monthly summary for an employee
router.get("/api/attendance/summary/:employeeId", requireAuth, async (req, res, next) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Month and year are required." });
    }

    const start = new Date(Number(year), Number(month) - 1, 1);
    const end = new Date(Number(year), Number(month), 1);

    const [employee, records] = await Promise.all([
      Employee.findById(req.params.employeeId).select("employeeId firstName lastName department").lean(),
      Attendance.find({
        employee: req.params.employeeId,
        date: { $gte: start, $lt: end },
      }).sort({ date: 1 }).lean(),
    ]);

    if (!employee) return res.status(404).json({ error: "NOT_FOUND", message: "Employee not found." });

    // Calculate summary
    const summary = {
      present: 0, absent: 0, halfDay: 0, late: 0, onLeave: 0, wfh: 0, holiday: 0,
      totalWorkHours: 0, totalOvertimeHours: 0,
    };

    records.forEach((r) => {
      if (r.status === "present") summary.present++;
      else if (r.status === "absent") summary.absent++;
      else if (r.status === "half-day") summary.halfDay++;
      else if (r.status === "late") summary.late++;
      else if (r.status === "on-leave") summary.onLeave++;
      else if (r.status === "work-from-home") summary.wfh++;
      else if (r.status === "holiday") summary.holiday++;

      summary.totalWorkHours += r.workHours || 0;
      summary.totalOvertimeHours += r.overtimeHours || 0;
    });

    return res.json({ ok: true, employee, summary, records });
  } catch (error) {
    return next(error);
  }
});

// POST /api/attendance - Mark attendance
router.post("/api/attendance", requireAuth, async (req, res, next) => {
  try {
    const { employee, employeeId: inputEmpId, date, status, checkIn, checkOut, overtimeHours, overtimePayRate, notes, adminNotes, ...rest } = req.body || {};
    const empId = employee || inputEmpId;

    if (!empId || !date || !status) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Employee, date, and status are required." });
    }

    // Try finding employee by _id or by employeeId string
    let emp = null;
    if (empId.match(/^[0-9a-fA-F]{24}$/)) {
      emp = await Employee.findById(empId).lean();
    }
    if (!emp) {
      emp = await Employee.findOne({ employeeId: empId }).lean();
    }
    if (!emp) return res.status(404).json({ error: "NOT_FOUND", message: "Employee not found." });

    const recordDate = new Date(date);
    recordDate.setHours(0, 0, 0, 0);

    // Map UI day status to standardized internal status if needed
    const statusMap = {
      "Present": "present",
      "Absent": "absent",
      "Half day": "half-day",
      "Paid leave": "paid-leave",
      "Unpaid leave": "unpaid-leave",
      "Week off": "week-off",
      "Public holiday": "holiday",
    };
    const normalizedStatus = statusMap[status] || status.toLowerCase().replace(/\s+/g, "-");

    const attendanceData = {
      employee: emp._id,
      employeeId: emp.employeeId,
      date: recordDate,
      status: normalizedStatus,
      checkIn: checkIn ? new Date(checkIn) : undefined,
      checkOut: checkOut ? new Date(checkOut) : undefined,
      overtimeHours: Number(overtimeHours) || 0,
      overtimePayRate: Number(overtimePayRate) || 15,
      notes: notes || adminNotes || "",
      markedBy: req.admin?._id,
      ...rest,
    };

    const attendance = await Attendance.findOneAndUpdate(
      { employee: emp._id, date: recordDate },
      { $set: attendanceData },
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(201).json({ ok: true, attendance });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/attendance/:id - Update attendance
router.put("/api/attendance/:id", requireAuth, async (req, res, next) => {
  try {
    const record = await Attendance.findById(req.params.id);
    if (!record) return res.status(404).json({ error: "NOT_FOUND", message: "Attendance record not found." });

    const { checkIn, checkOut, status, notes, overtimeHours, workLocation, leaveType, leaveReason } = req.body || {};

    if (status) {
      const statusMap = {
        "Present": "present",
        "Absent": "absent",
        "Half day": "half-day",
        "Paid leave": "paid-leave",
        "Unpaid leave": "unpaid-leave",
        "Week off": "week-off",
        "Public holiday": "holiday",
      };
      record.status = statusMap[status] || status.toLowerCase().replace(/\s+/g, "-");
    }
    if (notes !== undefined) record.notes = notes;
    if (overtimeHours !== undefined) record.overtimeHours = Number(overtimeHours) || 0;
    if (workLocation) record.workLocation = workLocation;
    if (leaveType) record.leaveType = leaveType;
    if (leaveReason !== undefined) record.leaveReason = leaveReason;
    if (checkIn !== undefined) record.checkIn = checkIn ? new Date(checkIn) : undefined;
    if (checkOut !== undefined) record.checkOut = checkOut ? new Date(checkOut) : undefined;

    await record.save();
    return res.json({ ok: true, attendance: record });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/attendance/:id - Delete attendance record
router.delete("/api/attendance/:id", requireAuth, async (req, res, next) => {
  try {
    const record = await Attendance.findByIdAndDelete(req.params.id).lean();
    if (!record) return res.status(404).json({ error: "NOT_FOUND", message: "Attendance record not found." });
    return res.json({ ok: true, message: "Attendance record deleted." });
  } catch (error) {
    return next(error);
  }
});

// POST /api/attendance/bulk - Bulk mark attendance for a date
router.post("/api/attendance/bulk", requireAuth, async (req, res, next) => {
  try {
    const { date, records, entries } = req.body || {};
    const items = records || entries;
    if (!date || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Date and records array are required." });
    }

    const recordDate = new Date(date);
    recordDate.setHours(0, 0, 0, 0);

    const results = { created: 0, updated: 0, errors: [] };

    for (const record of items) {
      try {
        const empId = record.employee || record.employeeId;
        const emp = await Employee.findById(empId).select("employeeId").lean();
        if (!emp) { results.errors.push({ employee: empId, error: "Employee not found" }); continue; }

        await Attendance.findOneAndUpdate(
          { employee: empId, date: recordDate },
          {
            $set: {
              employee: empId,
              employeeId: emp.employeeId,
              date: recordDate,
              status: record.status || "present",
              checkIn: record.checkIn ? new Date(record.checkIn) : undefined,
              checkOut: record.checkOut ? new Date(record.checkOut) : undefined,
              overtimeHours: Number(record.overtimeHours) || 0,
              markedBy: req.admin._id,
              notes: record.notes,
            },
          },
          { upsert: true, new: true, runValidators: true }
        );
        results.created++;
      } catch (err) {
        results.errors.push({ employee: record.employee || record.employeeId, error: err.message });
      }
    }

    return res.json({ ok: true, results });
  } catch (error) {
    return next(error);
  }
});

export default router;
