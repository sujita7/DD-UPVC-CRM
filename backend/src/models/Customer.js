import mongoose from "mongoose";

/**
 * Customer Model
 * Tracks all customers in the CRM system.
 * Used by: Payment Tracker, Invoices, Quotations
 */
const customerSchema = new mongoose.Schema(
  {
    // Auto-generated ID
    customerId: {
      type: String,
      unique: true,
    },

    // Type
    type: {
      type: String,
      enum: ["individual", "company"],
      default: "company",
    },

    // Identity
    name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },
    companyName: { type: String, trim: true },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, trim: true },
    alternatePhone: { type: String, trim: true },
    website: { type: String, trim: true },

    // GST / Tax
    gstNumber: { type: String, trim: true },
    panNumber: { type: String, trim: true },

    // Address - Billing
    billingAddress: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String, default: "India" },
      pincode: { type: String },
    },

    // Address - Shipping
    shippingAddress: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String, default: "India" },
      pincode: { type: String },
      sameAsBilling: { type: Boolean, default: true },
    },

    // Contact Person (for company type)
    contactPerson: {
      name: { type: String },
      designation: { type: String },
      email: { type: String },
      phone: { type: String },
    },

    // Credit Terms
    creditLimit: { type: Number, default: 0, min: 0 },
    creditDays: { type: Number, default: 30, min: 0 },
    currency: { type: String, default: "INR" },

    // Financial Summary (updated on each transaction)
    financial: {
      totalInvoiced: { type: Number, default: 0 },
      totalPaid: { type: Number, default: 0 },
      totalOutstanding: { type: Number, default: 0 },
      totalOverdue: { type: Number, default: 0 },
      lastPaymentDate: { type: Date },
      lastPaymentAmount: { type: Number, default: 0 },
    },

    // Status
    status: {
      type: String,
      enum: ["active", "inactive", "blocked"],
      default: "active",
    },

    // Tags / Category
    category: { type: String, trim: true },
    tags: { type: [String], default: [] },

    // Source (how did we get this customer)
    source: {
      type: String,
      enum: ["referral", "website", "social-media", "walk-in", "cold-call", "email", "other"],
      default: "other",
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
customerSchema.index({ customerId: 1 });
customerSchema.index({ email: 1 });
customerSchema.index({ status: 1 });
customerSchema.index({ name: "text", companyName: "text" });

// Auto-generate customerId
customerSchema.pre("save", async function (next) {
  if (!this.customerId) {
    const count = await mongoose.model("Customer").countDocuments();
    this.customerId = `CUST-${String(count + 1).padStart(5, "0")}`;
  }
  next();
});

const Customer = mongoose.model("Customer", customerSchema);
export default Customer;
