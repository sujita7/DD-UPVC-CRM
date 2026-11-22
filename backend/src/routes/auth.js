import { Router } from "express";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { authRateLimit } from "../middleware/rateLimiter.js";
import {
  login,
  logout,
  logoutAll,
  refreshSession,
  changePassword,
} from "../services/authService.js";
import { Admin } from "../models/index.js";

const router = Router();

// ──────────────────────────────────────────────────────────────────────────────
// Cookie Helpers
// ──────────────────────────────────────────────────────────────────────────────

function getRefreshCookie(req) {
  return req.cookies?.[`crm_refresh`] || "";
}

function setRefreshCookie(res, token, remember) {
  res.cookie("crm_refresh", token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/api/auth",
    ...(remember ? { maxAge: 30 * 24 * 60 * 60 * 1000 } : { maxAge: 7 * 24 * 60 * 60 * 1000 }),
  });
}

function clearRefreshCookie(res) {
  res.clearCookie("crm_refresh", {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/api/auth",
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Admin login - returns access token + sets refresh cookie
 */
router.post("/api/auth/login", authRateLimit, async (req, res, next) => {
  try {
    const { email, password, remember } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Email and password are required.",
      });
    }

    const result = await login({
      email,
      password,
      remember: !!remember,
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "",
    });

    setRefreshCookie(res, result.refreshToken, result.session.remember);

    // Don't send refreshToken in response body
    const { refreshToken, ...safeResult } = result;
    return res.json({ ok: true, ...safeResult });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh cookie
 */
router.post("/api/auth/refresh", async (req, res, next) => {
  try {
    const token = getRefreshCookie(req);

    const result = await refreshSession({
      refreshToken: token,
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "",
    });

    setRefreshCookie(res, result.refreshToken, result.session.remember);

    const { refreshToken, ...safeResult } = result;
    return res.json({ ok: true, ...safeResult });
  } catch (error) {
    clearRefreshCookie(res);
    return next(error);
  }
});

/**
 * POST /api/auth/logout
 * Logout current session
 */
router.post("/api/auth/logout", async (req, res, next) => {
  try {
    const token = getRefreshCookie(req);

    if (req.admin) {
      await logout({ adminId: req.admin._id, refreshToken: token });
    }

    clearRefreshCookie(res);
    return res.json({ ok: true, message: "Logged out successfully." });
  } catch (error) {
    clearRefreshCookie(res);
    return next(error);
  }
});

/**
 * POST /api/auth/logout-all
 * Logout from all devices (invalidate all sessions)
 */
router.post("/api/auth/logout-all", requireAuth, async (req, res, next) => {
  try {
    await logoutAll({ adminId: req.admin._id });
    clearRefreshCookie(res);
    return res.json({ ok: true, message: "Logged out from all devices." });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/auth/change-password
 * Change current admin's password
 */
router.post("/api/auth/change-password", requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const result = await changePassword({
      adminId: req.admin._id,
      currentPassword,
      newPassword,
    });
    clearRefreshCookie(res);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/auth/session
 * Get current session info
 */
router.get("/api/auth/session", requireAuth, (req, res) => {
  res.json({
    ok: true,
    admin: {
      _id: req.admin._id,
      name: req.admin.name,
      email: req.admin.email,
      role: req.admin.role,
      permissions: req.admin.permissions,
      status: req.admin.status,
      avatar: req.admin.avatar,
      lastLogin: req.admin.lastLogin,
    },
    session: {
      id: req.tokenPayload?.sid,
      signedInAt: req.tokenPayload?.iat
        ? new Date(req.tokenPayload.iat * 1000).toISOString()
        : null,
    },
  });
});

/**
 * GET /api/me
 * Get full current admin profile
 */
router.get("/api/me", requireAuth, async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.admin._id).lean();
    if (!admin) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Admin not found." });
    }

    return res.json({
      ok: true,
      admin: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        status: admin.status,
        phone: admin.phone,
        avatar: admin.avatar,
        department: admin.department,
        designation: admin.designation,
        lastLogin: admin.lastLogin,
        createdAt: admin.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * PUT /api/me
 * Update current admin profile
 */
router.put("/api/me", requireAuth, async (req, res, next) => {
  try {
    const { name, phone, avatar, department, designation } = req.body || {};

    const updated = await Admin.findByIdAndUpdate(
      req.admin._id,
      {
        $set: {
          ...(name && { name }),
          ...(phone !== undefined && { phone }),
          ...(avatar !== undefined && { avatar }),
          ...(department !== undefined && { department }),
          ...(designation !== undefined && { designation }),
        },
      },
      { new: true, runValidators: true }
    ).lean();

    return res.json({ ok: true, admin: updated });
  } catch (error) {
    return next(error);
  }
});

export default router;
