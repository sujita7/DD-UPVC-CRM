import mongoose from "mongoose";

/**
 * Employee Model
 * Tracks all employees in the CRM system.
 * Used by: Payroll, Attendance, Payment Tracker
 */
const employeeSchema = new mongoose.Schema(
  {
    // Employee Identity
    employeeId: {
      type: String,
      unique: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      unique: true,
    },
    phone: { type: String, trim: true },
    alternatePhone: { type: String, trim: true },
    avatar: { type: String },

    // Employment Details
    department: {
      type: String,
      trim: true,
      default: "General",
    },
    designation: {
      type: String,
      trim: true,
      default: "Employee",
    },
    paidLeaves: {
      type: Number,
      default: 0,
      min: 0,
    },
    employmentType: {
      type: String,
      enum: ["full-time", "part-time", "contract", "intern", "consultant"],
      default: "full-time",
    },
    joinDate: {
      type: Date,
      default: Date.now,
    },
    endDate: { type: Date },

    // Salary & Compensation
    salary: {
      basic: { type: Number, default: 0, min: 0 },
      hra: { type: Number, default: 0, min: 0 },         // House Rent Allowance
      da: { type: Number, default: 0, min: 0 },           // Dearness Allowance
      ta: { type: Number, default: 0, min: 0 },           // Travel Allowance
      medicalAllowance: { type: Number, default: 0, min: 0 },
      otherAllowances: { type: Number, default: 0, min: 0 },
      grossSalary: { type: Number, default: 0, min: 0 },  // Calculated
      pf: { type: Number, default: 0, min: 0 },           // Provident Fund deduction
      esi: { type: Number, default: 0, min: 0 },          // ESI deduction
      tds: { type: Number, default: 0, min: 0 },          // TDS deduction
      otherDeductions: { type: Number, default: 0, min: 0 },
      netSalary: { type: Number, default: 0, min: 0 },    // Calculated
    },
    currency: { type: String, default: "INR" },
    salaryFrequency: {
      type: String,
      enum: ["monthly", "weekly", "bi-weekly", "daily"],
      default: "monthly",
    },

    // Bank Details (for payroll)
    bankDetails: {
      accountHolderName: { type: String },
      bankName: { type: String },
      accountNumber: { type: String },
      ifscCode: { type: String },
      accountType: {
        type: String,
        enum: ["savings", "current", "salary"],
        default: "savings",
      },
    },

    // Address
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String, default: "India" },
      pincode: { type: String },
    },

    // Identity Documents
    documents: {
      panNumber: { type: String },
      aadharNumber: { type: String, trim: true, sparse: true, index: true },
      pfAccountNumber: { type: String },
      esiNumber: { type: String },
      uanNumber: { type: String },
    },

    // Status
    status: {
      type: String,
      enum: ["active", "inactive", "on-leave", "terminated", "probation"],
      default: "active",
    },

    // Emergency Contact
    emergencyContact: {
      name: { type: String },
      relation: { type: String },
      phone: { type: String },
    },

    // Notes
    notes: { type: String },

    // Created by admin
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes
employeeSchema.index({ department: 1 });
employeeSchema.index({ status: 1 });
employeeSchema.index({ joinDate: 1 });

// Pre-save: auto-generate employeeId and calculate gross/net salary
employeeSchema.pre("save", async function (next) {
  // Auto-generate employeeId if not set
  if (!this.employeeId) {
    const count = await mongoose.model("Employee").countDocuments();
    this.employeeId = `EMP${String(count + 1).padStart(4, "0")}`;
  }

  // Calculate gross salary
  const s = this.salary;
  s.grossSalary =
    (s.basic || 0) +
    (s.hra || 0) +
    (s.da || 0) +
    (s.ta || 0) +
    (s.medicalAllowance || 0) +
    (s.otherAllowances || 0);

  // Calculate net salary
  const totalDeductions =
    (s.pf || 0) +
    (s.esi || 0) +
    (s.tds || 0) +
    (s.otherDeductions || 0);

  s.netSalary = Math.max(0, s.grossSalary - totalDeductions);

  next();
});

// Virtual: full name
employeeSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

employeeSchema.set("toJSON", { virtuals: true });
employeeSchema.set("toObject", { virtuals: true });

const Employee = mongoose.model("Employee", employeeSchema);
export default Employee;
