import { Router } from "express";
import { requireAuth, requireAdminOrHigher } from "../middleware/auth.js";
import { Payroll, Employee, Attendance, Holiday, AdvancePayment } from "../models/index.js";

const router = Router();

// GET /api/payroll - List payroll records
router.get("/api/payroll", requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 100, employee, month, year, status } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (employee) filter.employee = employee;
    if (status) filter.paymentStatus = status;
    if (month) filter.month = Number(month);
    if (year) filter.year = Number(year);

    const [payrolls, total] = await Promise.all([
      Payroll.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("employee", "employeeId firstName lastName email department designation salary")
        .lean(),
      Payroll.countDocuments(filter),
    ]);

    return res.json({
      ok: true,
      payrolls,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/payroll/:id - Get single payroll
router.get("/api/payroll/:id", requireAuth, async (req, res, next) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate("employee", "employeeId firstName lastName department designation bankDetails")
      .populate("createdBy approvedBy", "name email")
      .lean();
    if (!payroll) return res.status(404).json({ error: "NOT_FOUND", message: "Payroll record not found." });
    return res.json({ ok: true, payroll });
  } catch (error) {
    return next(error);
  }
});

// POST /api/payroll - Create payroll record
router.post("/api/payroll", requireAuth, async (req, res, next) => {
  try {
    const { employee: empId, payPeriod, earnings, deductions, ...rest } = req.body || {};

    if (!empId || !payPeriod?.month || !payPeriod?.year) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Employee, month, and year are required." });
    }

    const emp = await Employee.findById(empId).lean();
    if (!emp) return res.status(404).json({ error: "NOT_FOUND", message: "Employee not found." });

    // Check duplicate
    const existing = await Payroll.findOne({
      employee: empId,
      month: payPeriod.month,
      year: payPeriod.year,
    });
    if (existing) {
      return res.status(409).json({
        error: "CONFLICT",
        message: "Payroll already generated for this employee for this period.",
        existing: { _id: existing._id, payrollId: existing.payrollId },
      });
    }

    // Build pay period dates
    const startDate = new Date(payPeriod.year, payPeriod.month - 1, 1);
    const endDate = new Date(payPeriod.year, payPeriod.month, 0, 23, 59, 59, 999); // Last day of month
    const daysInMonth = new Date(payPeriod.year, payPeriod.month, 0).getDate();

    // Auto-fetch attendance summary, holidays & advance payments if not provided
    const [attendanceRecords, holidaysList, advanceRecords] = await Promise.all([
      Attendance.find({
        employee: empId,
        date: { $gte: startDate, $lte: endDate },
      }).lean(),
      Holiday.find({
        date: { $gte: startDate, $lte: endDate },
      }).lean(),
      AdvancePayment.find({
        employee: empId,
        $or: [
          { month: payPeriod.month, year: payPeriod.year },
          { paymentDate: { $gte: startDate, $lte: endDate } },
        ],
      }).lean(),
    ]);

    const advanceDeduction = advanceRecords.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

    // Count Sundays in pay period
    let sundaysCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(payPeriod.year, payPeriod.month - 1, d).getDay() === 0) {
        sundaysCount++;
      }
    }

    // Count holidays not falling on Sunday
    let holidayCount = 0;
    const holidayDateSet = new Set();
    holidaysList.forEach((h) => {
      const hd = new Date(h.date);
      const key = `${hd.getFullYear()}-${hd.getMonth() + 1}-${hd.getDate()}`;
      if (!holidayDateSet.has(key)) {
        holidayDateSet.add(key);
        if (hd.getDay() !== 0) {
          holidayCount++;
        }
      }
    });

    const workingDaysInMonth = Math.max(1, daysInMonth - sundaysCount - holidayCount);

    let attendanceSummary = rest.attendance;
    if (!attendanceSummary) {
      const presentCount = attendanceRecords.filter((r) => r.status === "present" || r.status === "late").length;
      const absentCount = attendanceRecords.filter((r) => r.status === "absent" || r.status === "unpaid-leave").length;
      const halfDaysCount = attendanceRecords.filter((r) => r.status === "half-day").length;
      const paidLeaveCount = attendanceRecords.filter((r) => ["paid-leave", "on-leave", "leave"].includes(r.status)).length;
      const lateDaysCount = attendanceRecords.filter((r) => r.status === "late").length;
      const overtimeHoursCount = attendanceRecords.reduce((sum, r) => sum + (Number(r.overtimeHours) || 0), 0);

      attendanceSummary = {
        totalWorkingDays: workingDaysInMonth,
        presentDays: presentCount,
        absentDays: absentCount + (halfDaysCount * 0.5),
        halfDays: halfDaysCount,
        leaveDays: paidLeaveCount,
        paidLeaveDays: paidLeaveCount,
        weekOffDays: sundaysCount,
        holidayDays: holidayCount,
        lateDays: lateDaysCount,
        overtimeHours: overtimeHoursCount,
      };
    }

    const baseSalary = Number(emp.salary?.basic || emp.salary?.grossSalary || emp.baseSalary || 0);
    const oneDaySalary = workingDaysInMonth > 0 ? (baseSalary / workingDaysInMonth) : 0;
    const oneHourSalary = oneDaySalary > 0 ? (oneDaySalary / 8) : 0;

    // Allowed paid leaves from employee profile or attendance
    const profilePaidLeaves = Number(emp.paidLeaves !== undefined && emp.paidLeaves !== null ? emp.paidLeaves : 0);
    const effectivePaidLeaves = Math.max(profilePaidLeaves, attendanceSummary.paidLeaveDays || 0);

    // If absent days exceed paid leaves, deduct excess absent days * 1-day salary
    const totalAbsent = Number(attendanceSummary.absentDays || 0);
    const excessAbsentDays = Math.max(0, totalAbsent - effectivePaidLeaves);
    const absentDeduction = Math.round(excessAbsentDays * oneDaySalary);

    // Overtime pay = overtime hours * 1-hour salary
    const overtimeHours = Number(attendanceSummary.overtimeHours || 0);
    const overtimePay = Math.round(overtimeHours * oneHourSalary);

    // Auto-populate earnings from employee salary if not provided
    const earningsData = earnings || {
      basic: baseSalary,
      hra: emp.salary?.hra || 0,
      da: emp.salary?.da || 0,
      ta: emp.salary?.ta || 0,
      medicalAllowance: emp.salary?.medicalAllowance || 0,
      otherAllowances: emp.salary?.otherAllowances || 0,
    };
    earningsData.overtimePay = overtimePay;

    const deductionsData = deductions || {
      pf: emp.salary?.pf || 0,
      esi: emp.salary?.esi || 0,
      tds: emp.salary?.tds || 0,
      otherDeductions: emp.salary?.otherDeductions || 0,
    };
    deductionsData.absentDeduction = absentDeduction;
    deductionsData.advanceDeduction = advanceDeduction;

    const grossSalary = Math.round(
      Number(earningsData.basic || 0) +
      Number(earningsData.hra || 0) +
      Number(earningsData.da || 0) +
      Number(earningsData.ta || 0) +
      Number(earningsData.medicalAllowance || 0) +
      Number(earningsData.otherAllowances || 0) +
      Number(earningsData.overtimePay || 0)
    );

    const totalDeductions = Math.round(
      Number(deductionsData.pf || 0) +
      Number(deductionsData.esi || 0) +
      Number(deductionsData.tds || 0) +
      Number(deductionsData.otherDeductions || 0) +
      Number(deductionsData.absentDeduction || 0) +
      Number(deductionsData.advanceDeduction || 0)
    );

    const netSalary = Math.max(0, grossSalary - totalDeductions);

    const payroll = new Payroll({
      employee: empId,
      employeeId: emp.employeeId,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      month: payPeriod.month,
      year: payPeriod.year,
      payPeriod: {
        month: payPeriod.month,
        year: payPeriod.year,
        startDate,
        endDate,
      },
      attendance: attendanceSummary,
      earnings: earningsData,
      deductions: deductionsData,
      grossSalary,
      totalDeductions,
      netSalary,
      advanceDeduction,
      paymentBankDetails: emp.bankDetails || {},
      createdBy: req.admin._id,
      ...rest,
    });

    await payroll.save();
    return res.status(201).json({ ok: true, payroll });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/payroll/:id - Update payroll
router.put("/api/payroll/:id", requireAuth, async (req, res, next) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) return res.status(404).json({ error: "NOT_FOUND", message: "Payroll record not found." });

    if (payroll.paymentStatus === "paid") {
      return res.status(403).json({ error: "FORBIDDEN", message: "Cannot modify a paid payroll record." });
    }

    Object.assign(payroll, req.body);
    await payroll.save();

    return res.json({ ok: true, payroll });
  } catch (error) {
    return next(error);
  }
});

// POST /api/payroll/:id/approve - Approve payroll
router.post("/api/payroll/:id/approve", requireAuth, requireAdminOrHigher, async (req, res, next) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) return res.status(404).json({ error: "NOT_FOUND", message: "Payroll record not found." });

    payroll.paymentStatus = "approved";
    payroll.approvedBy = req.admin._id;
    payroll.approvedAt = new Date();
    await payroll.save();

    return res.json({ ok: true, message: "Payroll approved.", payroll });
  } catch (error) {
    return next(error);
  }
});

// POST /api/payroll/:id/mark-paid - Mark payroll as paid
router.post("/api/payroll/:id/mark-paid", requireAuth, requireAdminOrHigher, async (req, res, next) => {
  try {
    const { paymentDate, paymentMethod, paymentReference } = req.body || {};
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) return res.status(404).json({ error: "NOT_FOUND", message: "Payroll record not found." });

    payroll.paymentStatus = "paid";
    payroll.paymentDate = paymentDate ? new Date(paymentDate) : new Date();
    if (paymentMethod) payroll.paymentMethod = paymentMethod;
    if (paymentReference) payroll.paymentReference = paymentReference;
    await payroll.save();

    // Mark corresponding advance payments as deducted
    if (payroll.employee && (payroll.month || payroll.payPeriod?.month)) {
      const pMonth = payroll.month || payroll.payPeriod?.month;
      const pYear = payroll.year || payroll.payPeriod?.year;
      try {
        const advs = await AdvancePayment.find({
          employee: payroll.employee,
          $or: [
            { month: pMonth, year: pYear },
            { status: "pending" }
          ]
        }).lean();
        for (const a of advs) {
          await AdvancePayment.findByIdAndUpdate(a._id || a.id, {
            $set: { status: "deducted", payrollId: payroll._id || payroll.id }
          });
        }
      } catch (e) {
        console.warn("Could not auto-mark advance payments as deducted:", e.message);
      }
    }

    return res.json({ ok: true, message: "Payroll marked as paid.", payroll });
  } catch (error) {
    return next(error);
  }
});

// POST /api/payroll/generate-bulk - Generate payroll for all active employees for a period
router.post("/api/payroll/generate-bulk", requireAuth, async (req, res, next) => {
  try {
    const { month, year } = req.body || {};
    if (!month || !year) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Month and year are required." });
    }

    const activeEmployees = await Employee.find({ status: "active" }).lean();
    const results = { created: 0, updated: 0, skipped: 0, errors: [] };

    for (const emp of activeEmployees) {
      try {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        const [attendanceRecords, holidaysList, advanceRecords] = await Promise.all([
          Attendance.find({
            employee: emp._id,
            date: { $gte: startDate, $lte: endDate },
          }).lean(),
          Holiday.find({
            date: { $gte: startDate, $lte: endDate },
          }).lean(),
          AdvancePayment.find({
            employee: emp._id,
            $or: [
              { month: Number(month), year: Number(year) },
              { paymentDate: { $gte: startDate, $lte: endDate } },
            ],
          }).lean(),
        ]);

        const advanceDeduction = advanceRecords.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

        const daysInMonth = new Date(year, month, 0).getDate();

        // Calculate Sundays in month
        let sundaysCount = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          if (new Date(year, month - 1, d).getDay() === 0) {
            sundaysCount++;
          }
        }

        // Calculate holidays not on Sundays
        let holidayCount = 0;
        const holidayDateSet = new Set();
        holidaysList.forEach((h) => {
          const hd = new Date(h.date);
          const key = `${hd.getFullYear()}-${hd.getMonth() + 1}-${hd.getDate()}`;
          if (!holidayDateSet.has(key)) {
            holidayDateSet.add(key);
            if (hd.getDay() !== 0) {
              holidayCount++;
            }
          }
        });

        const workingDaysInMonth = Math.max(1, daysInMonth - sundaysCount - holidayCount);

        const presentCount = attendanceRecords.filter((r) => ["present", "late"].includes(r.status)).length;
        const absentCount = attendanceRecords.filter((r) => r.status === "absent" || r.status === "unpaid-leave").length;
        const halfDaysCount = attendanceRecords.filter((r) => r.status === "half-day").length;
        const paidLeaveCount = attendanceRecords.filter((r) => ["paid-leave", "on-leave", "leave"].includes(r.status)).length;
        const lateDaysCount = attendanceRecords.filter((r) => r.status === "late").length;
        const overtimeHoursCount = attendanceRecords.reduce((sum, r) => sum + (Number(r.overtimeHours) || 0), 0);

        const totalAbsent = absentCount + (halfDaysCount * 0.5);

        const attendanceSummary = {
          totalWorkingDays: workingDaysInMonth,
          presentDays: presentCount,
          absentDays: totalAbsent,
          halfDays: halfDaysCount,
          leaveDays: paidLeaveCount,
          paidLeaveDays: paidLeaveCount,
          weekOffDays: sundaysCount,
          holidayDays: holidayCount,
          lateDays: lateDaysCount,
          overtimeHours: overtimeHoursCount,
        };

        const baseSalary = Number(emp.salary?.basic || emp.salary?.grossSalary || emp.baseSalary || 0);
        const oneDaySalary = workingDaysInMonth > 0 ? (baseSalary / workingDaysInMonth) : 0;
        const oneHourSalary = oneDaySalary > 0 ? (oneDaySalary / 8) : 0;

        // Effective allowed paid leaves
        const profilePaidLeaves = Number(emp.paidLeaves !== undefined && emp.paidLeaves !== null ? emp.paidLeaves : 0);
        const effectivePaidLeaves = Math.max(profilePaidLeaves, paidLeaveCount);

        // Deduct excess absent days * 1-day salary
        const excessAbsentDays = Math.max(0, totalAbsent - effectivePaidLeaves);
        const absentDeduction = Math.round(excessAbsentDays * oneDaySalary);

        // Overtime addition = overtime hours * 1-hour salary
        const overtimePay = Math.round(overtimeHoursCount * oneHourSalary);

        const grossSalary = Math.round(
          baseSalary +
          Number(emp.salary?.hra || 0) +
          Number(emp.salary?.da || 0) +
          Number(emp.salary?.ta || 0) +
          Number(emp.salary?.medicalAllowance || 0) +
          Number(emp.salary?.otherAllowances || 0) +
          overtimePay
        );

        const totalDeductions = Math.round(
          Number(emp.salary?.pf || 0) +
          Number(emp.salary?.esi || 0) +
          Number(emp.salary?.tds || 0) +
          Number(emp.salary?.otherDeductions || 0) +
          absentDeduction +
          advanceDeduction
        );

        const netSalary = Math.max(0, grossSalary - totalDeductions);

        const payrollData = {
          employee: emp._id,
          employeeId: emp.employeeId,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          month: Number(month),
          year: Number(year),
          payPeriod: { month: Number(month), year: Number(year), startDate, endDate },
          attendance: attendanceSummary,
          earnings: {
            basic: baseSalary,
            hra: emp.salary?.hra || 0,
            da: emp.salary?.da || 0,
            ta: emp.salary?.ta || 0,
            medicalAllowance: emp.salary?.medicalAllowance || 0,
            otherAllowances: emp.salary?.otherAllowances || 0,
            overtimePay: overtimePay,
          },
          deductions: {
            pf: emp.salary?.pf || 0,
            esi: emp.salary?.esi || 0,
            tds: emp.salary?.tds || 0,
            otherDeductions: emp.salary?.otherDeductions || 0,
            absentDeduction: absentDeduction,
            advanceDeduction: advanceDeduction,
          },
          grossSalary,
          totalDeductions,
          netSalary,
          advanceDeduction,
          paymentBankDetails: emp.bankDetails || {},
          createdBy: req.admin?._id,
        };

        const existing = await Payroll.findOne({
          employee: emp._id,
          month: Number(month),
          year: Number(year),
        });

        if (existing) {
          if (existing.paymentStatus !== "paid") {
            Object.assign(existing, payrollData);
            await existing.save();
            results.updated++;
          } else {
            results.skipped++;
          }
        } else {
          const payroll = new Payroll(payrollData);
          await payroll.save();
          results.created++;
        }
      } catch (err) {
        results.errors.push({ employee: `${emp.firstName} ${emp.lastName}`, error: err.message });
      }
    }

    return res.json({ ok: true, results, message: `Payroll calculated: ${results.created} draft(s) created, ${results.updated} updated.` });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/payroll/:id - Delete draft payroll
router.delete("/api/payroll/:id", requireAuth, requireAdminOrHigher, async (req, res, next) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) return res.status(404).json({ error: "NOT_FOUND", message: "Payroll record not found." });

    if (payroll.paymentStatus !== "draft") {
      return res.status(403).json({ error: "FORBIDDEN", message: "Only draft payroll can be deleted." });
    }

    await payroll.deleteOne();
    return res.json({ ok: true, message: "Payroll record deleted." });
  } catch (error) {
    return next(error);
  }
});

export default router;
