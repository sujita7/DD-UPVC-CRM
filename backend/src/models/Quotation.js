import mongoose from "mongoose";

/**
 * Quotation Model
 * Sales quotations sent to customers before invoicing.
 * Can be converted to Invoice.
 */

// Reuse line item structure
const quotationLineItemSchema = new mongoose.Schema(
  {
    srNo: { type: Number, required: true },
    description: { type: String, required: true, trim: true },
    hsnCode: { type: String, trim: true },
    unit: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },
    taxRate: { type: Number, default: 18, min: 0 },
    taxAmount: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
  },
  { _id: false }
);

const quotationSchema = new mongoose.Schema(
  {
    // Auto-generated Quotation Number
    quotationNumber: {
      type: String,
      unique: true,
    },

    // Customer
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer is required"],
    },

    // Customer snapshot
    customerSnapshot: {
      name: { type: String },
      companyName: { type: String },
      email: { type: String },
      phone: { type: String },
      gstNumber: { type: String },
      billingAddress: {
        street: String,
        city: String,
        state: String,
        country: String,
        pincode: String,
      },
    },

    // Dates
    quotationDate: {
      type: Date,
      required: [true, "Quotation date is required"],
      default: Date.now,
    },
    validUntil: {
      type: Date,
      required: [true, "Valid until date is required"],
    },

    // Line Items
    lineItems: {
      type: [quotationLineItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "Quotation must have at least one line item",
      },
    },

    // Totals
    subTotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },

    taxBreakdown: {
      cgst: { type: Number, default: 0 },
      sgst: { type: Number, default: 0 },
      igst: { type: Number, default: 0 },
    },

    // Currency
    currency: { type: String, default: "INR" },

    // Status
    status: {
      type: String,
      enum: ["draft", "sent", "viewed", "accepted", "rejected", "expired", "converted"],
      default: "draft",
    },

    // Linked Invoice (if converted)
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
    },
    convertedAt: { type: Date },

    // Subject / Title
    subject: { type: String, trim: true },

    // Terms & Conditions
    termsAndConditions: { type: String },
    notes: { type: String },

    // Delivery Terms
    deliveryTerms: { type: String, trim: true },
    paymentTerms: { type: String, trim: true },
    warrantyTerms: { type: String, trim: true },

    // Email tracking
    emailSentAt: { type: Date },
    emailSentTo: { type: String },

    // Document
    documentUrl: { type: String },

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
quotationSchema.index({ quotationNumber: 1 });
quotationSchema.index({ customer: 1 });
quotationSchema.index({ status: 1 });
quotationSchema.index({ quotationDate: -1 });

// Pre-save: auto-generate quotation number and calculate totals
quotationSchema.pre("save", async function (next) {
  if (!this.quotationNumber) {
    const count = await mongoose.model("Quotation").countDocuments();
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    this.quotationNumber = `QUO-${year}${month}-${String(count + 1).padStart(5, "0")}`;
  }

  // Calculate line item amounts
  let subTotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  this.lineItems = this.lineItems.map((item, idx) => {
    const lineTotal = item.quantity * item.unitPrice;
    const discountAmt = (lineTotal * item.discount) / 100;
    const amountAfterDiscount = lineTotal - discountAmt;
    const taxAmt = (amountAfterDiscount * item.taxRate) / 100;
    const totalAmt = amountAfterDiscount + taxAmt;

    subTotal += lineTotal;
    discountTotal += discountAmt;
    taxTotal += taxAmt;

    return {
      ...item.toObject ? item.toObject() : item,
      srNo: idx + 1,
      taxAmount: parseFloat(taxAmt.toFixed(2)),
      amount: parseFloat(amountAfterDiscount.toFixed(2)),
      totalAmount: parseFloat(totalAmt.toFixed(2)),
    };
  });

  this.subTotal = parseFloat(subTotal.toFixed(2));
  this.discountTotal = parseFloat(discountTotal.toFixed(2));
  this.taxTotal = parseFloat(taxTotal.toFixed(2));
  this.taxBreakdown.igst = this.taxTotal;

  const beforeRound = subTotal - discountTotal + taxTotal;
  this.grandTotal = parseFloat(Math.round(beforeRound).toFixed(2));
  this.roundOff = parseFloat((this.grandTotal - beforeRound).toFixed(2));

  // Check if expired
  if (this.validUntil && new Date() > this.validUntil && this.status === "sent") {
    this.status = "expired";
  }

  next();
});

const Quotation = mongoose.model("Quotation", quotationSchema);
export default Quotation;
