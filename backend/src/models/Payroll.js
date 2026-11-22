import mongoose from "mongoose";

/**
 * Payroll Model
 * Monthly salary run for an employee.
 * Mirrors the payment-os payroll structure for one employee per month.
 */
const payrollSchema = new mongoose.Schema(
  {
    // Reference
    payrollId: {
      type: String,
      unique: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee reference is required"],
    },
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },

    // Pay Period
    payPeriod: {
      month: {
        type: Number,
        required: true,
        min: 1,
        max: 12,
      },
      year: {
        type: Number,
        required: true,
      },
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
    },

    // Attendance Summary for this pay period
    attendance: {
      totalWorkingDays: { type: Number, default: 0 },
      presentDays: { type: Number, default: 0 },
      absentDays: { type: Number, default: 0 },
      halfDays: { type: Number, default: 0 },
      leaveDays: { type: Number, default: 0 },
      paidLeaveDays: { type: Number, default: 0 },
      weekOffDays: { type: Number, default: 0 },
      holidayDays: { type: Number, default: 0 },
      lateDays: { type: Number, default: 0 },
      overtimeHours: { type: Number, default: 0 },
    },

    // Earnings
    earnings: {
      basic: { type: Number, default: 0 },
      hra: { type: Number, default: 0 },
      da: { type: Number, default: 0 },
      ta: { type: Number, default: 0 },
      medicalAllowance: { type: Number, default: 0 },
      otherAllowances: { type: Number, default: 0 },
      overtimePay: { type: Number, default: 0 },
      bonus: { type: Number, default: 0 },
      grossEarnings: { type: Number, default: 0 }, // Calculated
    },

    // Deductions
    deductions: {
      pf: { type: Number, default: 0 },          // Provident Fund (Employee share)
      pfEmployer: { type: Number, default: 0 },   // PF Employer share
      esi: { type: Number, default: 0 },          // ESI (Employee share)
      esiEmployer: { type: Number, default: 0 },  // ESI Employer share
      tds: { type: Number, default: 0 },          // Income Tax
      professionalTax: { type: Number, default: 0 },
      loanDeduction: { type: Number, default: 0 },
      absentDeduction: { type: Number, default: 0 }, // Salary deducted for absent days
      otherDeductions: { type: Number, default: 0 },
      totalDeductions: { type: Number, default: 0 }, // Calculated
    },

    // Net Pay
    netPay: { type: Number, default: 0 },

    // Payment Details
    paymentStatus: {
      type: String,
      enum: ["draft", "approved", "paid", "cancelled", "on-hold"],
      default: "draft",
    },
    paymentDate: { type: Date },
    paymentMethod: {
      type: String,
      enum: ["bank-transfer", "cash", "cheque", "upi", "other"],
    },
    paymentReference: { type: String }, // Transaction ID / Cheque number

    // Bank Details snapshot at time of payment
    paymentBankDetails: {
      bankName: { type: String },
      accountNumber: { type: String },
      ifscCode: { type: String },
    },

    // Payslip
    payslipGenerated: { type: Boolean, default: false },
    payslipUrl: { type: String },

    // Remarks
    remarks: { type: String },

    // Workflow
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    approvedAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes
payrollSchema.index({ employee: 1, "payPeriod.month": 1, "payPeriod.year": 1 }, { unique: true });
payrollSchema.index({ paymentStatus: 1 });
payrollSchema.index({ "payPeriod.year": 1, "payPeriod.month": 1 });
payrollSchema.index({ payrollId: 1 });

// Pre-save: auto-generate payrollId and calculate totals
payrollSchema.pre("save", async function (next) {
  // Auto-generate payrollId
  if (!this.payrollId) {
    const count = await mongoose.model("Payroll").countDocuments();
    const year = this.payPeriod.year || new Date().getFullYear();
    const month = String(this.payPeriod.month || 1).padStart(2, "0");
    this.payrollId = `PAY-${year}${month}-${String(count + 1).padStart(4, "0")}`;
  }

  // Calculate gross earnings
  const e = this.earnings;
  e.grossEarnings =
    (e.basic || 0) +
    (e.hra || 0) +
    (e.da || 0) +
    (e.ta || 0) +
    (e.medicalAllowance || 0) +
    (e.otherAllowances || 0) +
    (e.overtimePay || 0) +
    (e.bonus || 0);

  // Calculate total deductions
  const d = this.deductions;
  d.totalDeductions =
    (d.pf || 0) +
    (d.esi || 0) +
    (d.tds || 0) +
    (d.professionalTax || 0) +
    (d.loanDeduction || 0) +
    (d.absentDeduction || 0) +
    (d.otherDeductions || 0);

  // Calculate net pay
  this.netPay = Math.max(0, e.grossEarnings - d.totalDeductions);

  next();
});

const Payroll = mongoose.model("Payroll", payrollSchema);
export default Payroll;
