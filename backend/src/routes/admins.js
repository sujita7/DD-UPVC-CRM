import { Router } from "express";
import { requireAuth, requireAdminOrHigher, requireSuperAdmin } from "../middleware/auth.js";
import { Admin } from "../models/index.js";

const router = Router();

/**
 * GET /api/admins
 * List all admins (superadmin only)
 */
router.get("/api/admins", requireAuth, requireAdminOrHigher, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, role, search } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const [admins, total] = await Promise.all([
      Admin.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Admin.countDocuments(filter),
    ]);

    return res.json({
      ok: true,
      admins,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/admins/:id
 * Get single admin by ID
 */
router.get("/api/admins/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.params.id).lean();
    if (!admin) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Admin not found." });
    }
    return res.json({ ok: true, admin });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/admins
 * Create new admin (superadmin only)
 */
router.post("/api/admins", requireAuth, requireAdminOrHigher, async (req, res, next) => {
  try {
    const { name, email, password, role, permissions, phone, department, designation } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Name, email, and password are required.",
      });
    }

    const existing = await Admin.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        error: "CONFLICT",
        message: "An admin with this email already exists.",
      });
    }

    const admin = new Admin({
      name,
      email,
      password,
      role: role || "admin",
      permissions: permissions || [],
      phone,
      department,
      designation,
    });

    await admin.save();

    return res.status(201).json({ ok: true, admin: admin.toPublic() });
  } catch (error) {
    return next(error);
  }
});

/**
 * PUT /api/admins/:id
 * Update admin (superadmin only)
 */
router.put("/api/admins/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const { name, role, permissions, status, phone, department, designation } = req.body || {};

    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Admin not found." });
    }

    // Prevent removing own superadmin status
    if (String(admin._id) === String(req.admin._id) && role && role !== "superadmin") {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "You cannot downgrade your own role.",
      });
    }

    const updates = {};
    if (name) updates.name = name;
    if (role) updates.role = role;
    if (permissions) updates.permissions = permissions;
    if (status) updates.status = status;
    if (phone !== undefined) updates.phone = phone;
    if (department !== undefined) updates.department = department;
    if (designation !== undefined) updates.designation = designation;

    const updated = await Admin.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    return res.json({ ok: true, admin: updated });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/admins/:id
 * Soft-delete (deactivate) admin (superadmin only)
 */
router.delete("/api/admins/:id", requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.admin._id)) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: "You cannot delete your own account.",
      });
    }

    const admin = await Admin.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "inactive" } },
      { new: true }
    ).lean();

    if (!admin) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Admin not found." });
    }

    return res.json({ ok: true, message: "Admin deactivated successfully.", admin });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/admins/:id/reset-password
 * Reset admin password (superadmin only)
 */
router.post("/api/admins/:id/reset-password", requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const { newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "New password must be at least 8 characters.",
      });
    }

    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Admin not found." });
    }

    admin.password = newPassword;
    admin.refreshTokens = [];
    await admin.save();

    return res.json({ ok: true, message: "Password reset successfully." });
  } catch (error) {
    return next(error);
  }
});

export default router;
