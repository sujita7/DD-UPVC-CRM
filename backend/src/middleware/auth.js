import { verifyAccessToken } from "../services/authService.js";
import { Admin } from "../models/index.js";

/**
 * Auth Middleware
 * Verifies JWT access token and attaches admin to req.admin.
 * Mirrors the requireAuth middleware from payment-os.
 */

export async function requireAuth(req, res, next) {
  try {
    // Already authenticated (middleware composed multiple times)
    if (req.admin && req.tokenPayload) return next();

    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

    if (!token) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Authentication required. Please sign in.",
      });
    }

    // Verify token
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      const message =
        error.name === "TokenExpiredError"
          ? "Session expired. Please sign in again."
          : "Invalid access token.";
      return res.status(401).json({ error: "UNAUTHORIZED", message });
    }

    // Find admin
    const admin = await Admin.findById(payload.sub).lean();

    if (!admin) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "User not found." });
    }

    if (admin.status !== "active") {
      return res.status(403).json({
        error: "ACCOUNT_INACTIVE",
        message: `Your account is ${admin.status}. Contact administrator.`,
      });
    }

    // Session version check
    if (Number(admin.sessionVersion || 1) !== Number(payload.ver || 1)) {
      return res.status(401).json({
        error: "SESSION_INVALIDATED",
        message: "Session invalidated. Please sign in again.",
      });
    }

    // Attach to request
    req.admin = { ...admin };
    req.tokenPayload = payload;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ error: "SERVER_ERROR", message: "Authentication failed." });
  }
}

/**
 * Require specific role
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required." });
    }
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({
        error: "FORBIDDEN",
        message: `Access denied. Required role: ${roles.join(" or ")}`,
        requiredRoles: roles,
        yourRole: req.admin.role,
      });
    }
    return next();
  };
}

/**
 * Require superadmin
 */
export const requireSuperAdmin = requireRole("superadmin");

/**
 * Require admin or superadmin
 */
export const requireAdminOrHigher = requireRole("superadmin", "admin");

/**
 * Optional auth - attach admin if token present, don't block if not
 */
export async function optionalAuth(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) return next();

    const payload = verifyAccessToken(token);
    const admin = await Admin.findById(payload.sub).lean();
    if (admin && admin.status === "active") {
      req.admin = admin;
      req.tokenPayload = payload;
    }
    next();
  } catch {
    next(); // Ignore errors in optional auth
  }
}
