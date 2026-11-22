import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { Employee, Attendance, Payroll, Payment, Invoice, Customer } from "../models/index.js";

const router = Router();

/**
 * GET /api/dashboard
 * Returns dashboard stats and summary
 */
router.get("/api/dashboard", requireAuth, async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const [
      totalEmployees,
      activeEmployees,
      totalCustomers,
      activeCustomers,
      totalSuppliers,

      // Today's attendance
      todayPresent,
      todayAbsent,

      // This month's payroll
      monthPayroll,

      // Payment stats
      receivedThisMonth,
      madeThisMonth,

      // Invoice stats
      unpaidInvoices,
      overdueInvoices,

      // Recent payments
      recentPayments,

      // Recent invoices
      recentInvoices,
    ] = await Promise.all([
      Employee.countDocuments(),
      Employee.countDocuments({ status: "active" }),
      (await import("../models/Customer.js")).default.countDocuments(),
      (await import("../models/Customer.js")).default.countDocuments({ status: "active" }),
      (await import("../models/Supplier.js")).default.countDocuments(),

      // Attendance today
      Attendance.countDocuments({ date: { $gte: today, $lt: tomorrow }, status: "present" }),
      Attendance.countDocuments({ date: { $gte: today, $lt: tomorrow }, status: "absent" }),

      // Payroll this month
      Payroll.aggregate([
        { $match: { "payPeriod.month": today.getMonth() + 1, "payPeriod.year": today.getFullYear() } },
        { $group: { _id: null, totalNetPay: { $sum: "$netPay" }, count: { $sum: 1 } } },
      ]),

      // Payments received this month
      Payment.aggregate([
        { $match: { paymentType: "received", paymentDate: { $gte: thisMonth, $lt: nextMonth }, status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),

      // Payments made this month
      Payment.aggregate([
        { $match: { paymentType: "made", paymentDate: { $gte: thisMonth, $lt: nextMonth }, status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),

      // Unpaid invoices
      Invoice.aggregate([
        { $match: { paymentStatus: "unpaid" } },
        { $group: { _id: null, total: { $sum: "$amountDue" }, count: { $sum: 1 } } },
      ]),

      // Overdue invoices
      Invoice.aggregate([
        { $match: { paymentStatus: "overdue" } },
        { $group: { _id: null, total: { $sum: "$amountDue" }, count: { $sum: 1 } } },
      ]),

      // Recent payments (last 5)
      Payment.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("paymentId partyName amount paymentType paymentDate status paymentMethod")
        .lean(),

      // Recent invoices (last 5)
      Invoice.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("customer", "name companyName")
        .select("invoiceNumber grandTotal paymentStatus invoiceDate dueDate")
        .lean(),
    ]);

    const dashboardData = {
      employees: {
        total: totalEmployees,
        active: activeEmployees,
      },
      customers: {
        total: totalCustomers,
        active: activeCustomers,
      },
      suppliers: {
        total: totalSuppliers,
      },
      attendanceToday: {
        present: todayPresent,
        absent: todayAbsent,
        totalMarked: todayPresent + todayAbsent,
      },
      payroll: {
        totalNetPay: monthPayroll[0]?.totalNetPay || 0,
        count: monthPayroll[0]?.count || 0,
        paidAmount: monthPayroll[0]?.totalNetPay || 0,
      },
      payments: {
        totalCustomerReceived: receivedThisMonth[0]?.total || 0,
        totalSupplierPaid: madeThisMonth[0]?.total || 0,
        totalPayrollPaid: monthPayroll[0]?.totalNetPay || 0,
      },
      invoices: {
        totalInvoiced: unpaidInvoices[0]?.total || 0,
        totalPaid: receivedThisMonth[0]?.total || 0,
        totalPending: unpaidInvoices[0]?.total || 0,
      },
      recentPayments,
      recentInvoices,
    };

    return res.json({
      ok: true,
      data: dashboardData,
      stats: dashboardData,
      ...dashboardData,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
