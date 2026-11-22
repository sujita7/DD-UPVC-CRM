import mongoose from "mongoose";

/**
 * Invoice Model
 * Sales invoices sent to customers.
 */

// Line item schema
const lineItemSchema = new mongoose.Schema(
  {
    srNo: { type: Number, required: true },
    description: {
      type: String,
      required: [true, "Item description is required"],
      trim: true,
    },
    hsnCode: { type: String, trim: true },  // HSN / SAC code for GST
    unit: { type: String, trim: true },
    quantity: {
      type: Number,
      required: true,
      min: [0, "Quantity cannot be negative"],
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, "Unit price cannot be negative"],
    },
    discount: { type: Number, default: 0, min: 0, max: 100 }, // Percentage
    taxRate: { type: Number, default: 18, min: 0 },           // GST %
    taxAmount: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },  // After discount, before tax
    totalAmount: { type: Number, default: 0 }, // Including tax
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    // Auto-generated Invoice Number
    invoiceNumber: {
      type: String,
      unique: true,
    },

    // Type
    invoiceType: {
      type: String,
      enum: ["tax-invoice", "proforma", "credit-note", "debit-note"],
      default: "tax-invoice",
    },

    // Customer
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer is required"],
    },

    // Customer snapshot (at time of invoice)
    customerSnapshot: {
      name: { type: String },
      companyName: { type: String },
      email: { type: String },
      phone: { type: String },
      gstNumber: { type: String },
      panNumber: { type: String },
      billingAddress: {
        street: String,
        city: String,
        state: String,
        country: String,
        pincode: String,
      },
    },

    // Dates
    invoiceDate: {
      type: Date,
      required: [true, "Invoice date is required"],
      default: Date.now,
    },
    dueDate: { type: Date, required: [true, "Due date is required"] },

    // Line Items
    lineItems: {
      type: [lineItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "Invoice must have at least one line item",
      },
    },

    // Totals
    subTotal: { type: Number, default: 0 },     // Before tax
    discountTotal: { type: Number, default: 0 },
    taxBreakdown: {
      cgst: { type: Number, default: 0 },       // Central GST
      sgst: { type: Number, default: 0 },       // State GST
      igst: { type: Number, default: 0 },       // Integrated GST
      cess: { type: Number, default: 0 },
    },
    taxTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },   // Final amount

    // Rounding
    roundOff: { type: Number, default: 0 },

    // Currency
    currency: { type: String, default: "INR" },

    // Payment Status
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partially-paid", "paid", "overdue", "cancelled", "refunded"],
      default: "unpaid",
    },
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },

    // Payments linked
    payments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
      },
    ],

    // Terms & Conditions
    termsAndConditions: { type: String },
    paymentTerms: { type: String },
    notes: { type: String },

    // Bank Details for payment
    paymentBankDetails: {
      bankName: { type: String },
      accountNumber: { type: String },
      ifscCode: { type: String },
      upiId: { type: String },
    },

    // Linked Quotation
    quotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
    },

    // Document
    documentUrl: { type: String }, // Generated PDF URL

    // Status
    status: {
      type: String,
      enum: ["draft", "sent", "viewed", "accepted", "cancelled"],
      default: "draft",
    },

    // Email tracking
    emailSentAt: { type: Date },
    emailSentTo: { type: String },

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
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ customer: 1 });
invoiceSchema.index({ paymentStatus: 1 });
invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ status: 1 });

// Pre-save: auto-generate invoice number and calculate totals
invoiceSchema.pre("save", async function (next) {
  // Auto-generate invoice number
  if (!this.invoiceNumber) {
    const count = await mongoose.model("Invoice").countDocuments();
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    this.invoiceNumber = `INV-${year}${month}-${String(count + 1).padStart(5, "0")}`;
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

  // GST split (simplified: IGST for inter-state, CGST+SGST for intra-state)
  // Default to IGST for simplicity; can be made configurable
  this.taxBreakdown.igst = this.taxTotal;
  this.taxBreakdown.cgst = 0;
  this.taxBreakdown.sgst = 0;

  const beforeRound = subTotal - discountTotal + taxTotal;
  this.grandTotal = parseFloat(Math.round(beforeRound).toFixed(2));
  this.roundOff = parseFloat((this.grandTotal - beforeRound).toFixed(2));

  // Update amount due
  this.amountDue = Math.max(0, this.grandTotal - (this.amountPaid || 0));

  // Update payment status
  if (this.amountPaid >= this.grandTotal) {
    this.paymentStatus = "paid";
  } else if (this.amountPaid > 0) {
    this.paymentStatus = "partially-paid";
  } else if (this.dueDate && new Date() > this.dueDate && this.paymentStatus === "unpaid") {
    this.paymentStatus = "overdue";
  }

  next();
});

const Invoice = mongoose.model("Invoice", invoiceSchema);
export default Invoice;
