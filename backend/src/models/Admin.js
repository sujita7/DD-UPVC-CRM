import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const adminSchema = new mongoose.Schema(
  {
    // Identity
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // Never return password in queries by default
    },

    // Role & Permissions
    role: {
      type: String,
      enum: ["superadmin", "admin", "manager"],
      default: "admin",
    },
    permissions: {
      type: [String],
      default: [],
    },

    // Profile
    phone: { type: String, trim: true },
    avatar: { type: String },
    department: { type: String, trim: true },
    designation: { type: String, trim: true },

    // Status
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },

    // Security
    sessionVersion: {
      type: Number,
      default: 1,
    },
    lastLogin: { type: Date },
    lastLoginIp: { type: String },
    passwordChangedAt: { type: Date },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    // Refresh tokens (stored as hashed tokens)
    refreshTokens: {
      type: [
        {
          token: { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
          expiresAt: { type: Date, required: true },
          ipAddress: { type: String },
          userAgent: { type: String },
        },
      ],
      select: false,
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes
adminSchema.index({ status: 1 });
adminSchema.index({ role: 1 });

// Hash password before saving
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  if (this.isModified("password") && !this.isNew) {
    this.passwordChangedAt = new Date();
    this.sessionVersion = (this.sessionVersion || 1) + 1;
  }
  next();
});

// Compare password method
adminSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if password changed after JWT issued
adminSchema.methods.passwordChangedAfter = function (jwtIssuedAt) {
  if (this.passwordChangedAt) {
    const changedTime = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return jwtIssuedAt < changedTime;
  }
  return false;
};

// Sanitize output (remove sensitive fields)
adminSchema.methods.toPublic = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokens;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

const Admin = mongoose.model("Admin", adminSchema);
export default Admin;
