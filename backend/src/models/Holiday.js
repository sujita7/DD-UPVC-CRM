import mongoose from "mongoose";

/**
 * Holiday Model
 * Tracks official holidays and non-working days.
 * On holidays, regular attendance is not required/calculated.
 * Employees working on holiday can be credited with overtime.
 */
const holidaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Holiday name is required"],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, "Holiday date is required"],
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isOptional: {
      type: Boolean,
      default: false,
    },
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

holidaySchema.index({ date: 1 });

const Holiday = mongoose.model("Holiday", holidaySchema);
export default Holiday;

