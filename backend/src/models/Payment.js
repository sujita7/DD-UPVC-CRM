import mongoose from "mongoose";

/**
 * Payment Model
 * Tracks payments from/to customers and suppliers and payroll.
 */
const paymentSchema = new mongoose.Schema(
  {
    // Auto-generated Payment ID
    paymentId: {
      type: String,
      unique: true,
    },

    // Payment Type
    paymentType: {
      type: String,
      enum: ["received", "made", "payroll"],
      required: [true, "Payment type is required"],
      // received = customer pays us
      // made = we pay supplier
      // payroll = employee salary payment
    },

    // Party Reference (polymorphic-like)
    partyType: {
      type: String,
      enum: ["customer", "supplier", "employee"],
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },

    // Party Name (snapshot)
    partyName: { type: String, required: true },

    // Amount
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than 0"],
    },
    currency: { type: String, default: "INR" },

    // Payment Method
    paymentMethod: {
      type: String,
      enum: ["cash", "bank-transfer", "cheque", "upi", "neft", "rtgs", "imps", "dd", "card", "other"],
      required: true,
    },
    paymentReference: { type: String, trim: true }, // Transaction ID / Cheque number

    // Payment Date
    paymentDate: {
      type: Date,
      required: [true, "Payment date is required"],
      default: Date.now,
    },

    // Status
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "cancelled", "refunded"],
      default: "completed",
    },

    // Linked Invoice/Bill (if any)
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
    },
    payroll: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payroll",
    },

    // Bank Details snapshot
    bankDetails: {
      bankName: { type: String },
      accountNumber: { type: String },
      ifscCode: { type: String },
    },

    // Category / Purpose
    category: { type: String, trim: true },
    description: { type: String, trim: true },

    // Tax
    tdsAmount: { type: Number, default: 0 },
    tdsRate: { type: Number, default: 0 },

    // Attachments (receipts / proof)
    attachments: {
      type: [{ fileName: String, fileUrl: String, uploadedAt: Date }],
      default: [],
    },

    // Notes
    notes: { type: String },

    // Created by
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
paymentSchema.index({ paymentId: 1 });
paymentSchema.index({ paymentType: 1 });
paymentSchema.index({ partyType: 1 });
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ customer: 1 });
paymentSchema.index({ supplier: 1 });
paymentSchema.index({ employee: 1 });

// Auto-generate paymentId
paymentSchema.pre("save", async function (next) {
  if (!this.paymentId) {
    const count = await mongoose.model("Payment").countDocuments();
    const prefix = this.paymentType === "received" ? "REC" : this.paymentType === "made" ? "PAY" : "SAL";
    this.paymentId = `${prefix}-${String(count + 1).padStart(6, "0")}`;
  }
  next();
});

const Payment = mongoose.model("Payment", paymentSchema);
export default Payment;
