import mongoose from "mongoose";

/**
 * Attendance Model
 * Tracks daily attendance of each employee.
 * Features: Clock In/Out, status, overtime, work hours calculation
 */
const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Employee reference is required"],
    },
    employeeId: {
      type: String,
      required: true,
    },

    // Date (YYYY-MM-DD format stored as Date for querying)
    date: {
      type: Date,
      required: [true, "Date is required"],
    },

    // Attendance Status
    status: {
      type: String,
      enum: [
        "present",
        "absent",
        "half-day",
        "late",
        "on-leave",
        "paid-leave",
        "unpaid-leave",
        "week-off",
        "work-from-home",
        "holiday",
        "weekend",
      ],
      required: [true, "Attendance status is required"],
    },

    // Time Tracking
    checkIn: { type: Date },
    checkOut: { type: Date },

    // Work hours & Overtime (in hours)
    workHours: { type: Number, default: 0, min: 0 },
    overtimeHours: { type: Number, default: 0, min: 0 },
    overtimePayRate: { type: Number, default: 15 }, // Per overtime hour/unit or extra day bonus

    // Standard working hours per day
    standardHours: { type: Number, default: 8 },

    // Late arrival tracking (minutes late)
    lateMinutes: { type: Number, default: 0, min: 0 },

    // Leave details (if on-leave)
    leaveType: {
      type: String,
      enum: ["casual", "sick", "earned", "maternity", "paternity", "unpaid", "other"],
    },
    leaveReason: { type: String, trim: true },

    // Work location
    workLocation: {
      type: String,
      enum: ["office", "wfh", "field", "other"],
      default: "office",
    },

    // Notes
    notes: { type: String, trim: true },

    // Who marked this attendance
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound index: unique attendance per employee per day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ status: 1 });
attendanceSchema.index({ employeeId: 1 });

// Pre-save: calculate workHours and overtimeHours
attendanceSchema.pre("save", function (next) {
  if (this.checkIn && this.checkOut) {
    const diffMs = this.checkOut.getTime() - this.checkIn.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    this.workHours = Math.max(0, parseFloat(diffHours.toFixed(2)));

    // Overtime calculation
    const standard = this.standardHours || 8;
    this.overtimeHours = Math.max(0, parseFloat((diffHours - standard).toFixed(2)));

    // Late minutes calculation (assume 9:00 AM is standard start)
    if (this.checkIn) {
      const standardStart = new Date(this.checkIn);
      standardStart.setHours(9, 0, 0, 0);
      const lateDiff = this.checkIn.getTime() - standardStart.getTime();
      this.lateMinutes = lateDiff > 0 ? Math.round(lateDiff / (1000 * 60)) : 0;

      // Mark as late if more than 15 minutes late and was present
      if (this.lateMinutes > 15 && this.status === "present") {
        this.status = "late";
      }
    }
  }
  next();
});

const Attendance = mongoose.model("Attendance", attendanceSchema);
export default Attendance;
