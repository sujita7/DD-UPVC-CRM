import mongoose from "mongoose";

/**
 * Supplier Model
 * Tracks all suppliers/vendors in the CRM system.
 * Used by: Payment Tracker, Purchase Bills
 */
const supplierSchema = new mongoose.Schema(
  {
    // Auto-generated ID
    supplierId: {
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
      required: [true, "Supplier name is required"],
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
    msmeNumber: { type: String, trim: true }, // MSME registration
    tdsRate: { type: Number, default: 0, min: 0 }, // TDS percentage

    // Address
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String, default: "India" },
      pincode: { type: String },
    },

    // Contact Person
    contactPerson: {
      name: { type: String },
      designation: { type: String },
      email: { type: String },
      phone: { type: String },
    },

    // Payment Terms
    paymentTerms: { type: Number, default: 30 }, // days
    currency: { type: String, default: "INR" },

    // Bank Details (for payments)
    bankDetails: {
      accountHolderName: { type: String },
      bankName: { type: String },
      accountNumber: { type: String },
      ifscCode: { type: String },
      accountType: {
        type: String,
        enum: ["savings", "current"],
        default: "current",
      },
      swiftCode: { type: String }, // For international
    },

    // Financial Summary
    financial: {
      totalPurchased: { type: Number, default: 0 },
      totalPaid: { type: Number, default: 0 },
      totalOutstanding: { type: Number, default: 0 },
      totalOverdue: { type: Number, default: 0 },
      lastPaymentDate: { type: Date },
      lastPaymentAmount: { type: Number, default: 0 },
    },

    // Category / Products supplied
    category: { type: String, trim: true },
    productsSupplied: { type: [String], default: [] },
    tags: { type: [String], default: [] },

    // Status
    status: {
      type: String,
      enum: ["active", "inactive", "blacklisted"],
      default: "active",
    },

    // Rating (1-5)
    rating: { type: Number, min: 1, max: 5 },

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
supplierSchema.index({ supplierId: 1 });
supplierSchema.index({ email: 1 });
supplierSchema.index({ status: 1 });
supplierSchema.index({ name: "text", companyName: "text" });

// Auto-generate supplierId
supplierSchema.pre("save", async function (next) {
  if (!this.supplierId) {
    const count = await mongoose.model("Supplier").countDocuments();
    this.supplierId = `SUPP-${String(count + 1).padStart(5, "0")}`;
  }
  next();
});

const Supplier = mongoose.model("Supplier", supplierSchema);
export default Supplier;
