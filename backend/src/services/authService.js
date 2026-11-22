import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env.js";
import { Admin } from "../models/index.js";

/**
 * AuthService
 * Handles login, logout, token generation/verification for Admin users.
 * Mirrors the pattern from payment-os authService.js but simplified for CRM.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Token Generation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Sign an access token (short-lived JWT)
 */
export function signAccessToken(payload) {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    issuer: "crm-api",
    audience: "crm-admin",
  });
}

/**
 * Sign a refresh token (long-lived JWT)
 */
export function signRefreshToken(payload) {
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
    issuer: "crm-api",
    audience: "crm-admin",
  });
}

/**
 * Verify an access token
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret, {
      issuer: "crm-api",
      audience: "crm-admin",
    });
  } catch (error) {
    throw error; // TokenExpiredError, JsonWebTokenError, etc.
  }
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, env.jwtRefreshSecret, {
      issuer: "crm-api",
      audience: "crm-admin",
    });
  } catch (error) {
    throw error;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Auth Operations
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Login admin user
 * Returns: { accessToken, refreshToken, admin }
 */
export async function login({ email, password, ipAddress, userAgent, remember = false }) {
  if (!email || !password) {
    throw Object.assign(new Error("Email and password are required."), { code: "VALIDATION_ERROR", status: 400 });
  }

  // Find admin with password
  const admin = await Admin.findOne({ email: email.toLowerCase().trim() }).select("+password +refreshTokens");

  if (!admin) {
    throw Object.assign(new Error("Invalid email or password."), { code: "INVALID_CREDENTIALS", status: 401 });
  }

  if (admin.status !== "active") {
    throw Object.assign(
      new Error(`Your account is ${admin.status}. Please contact the system administrator.`),
      { code: "ACCOUNT_INACTIVE", status: 403 }
    );
  }

  // Verify password
  const isPasswordValid = await admin.comparePassword(password);
  if (!isPasswordValid) {
    throw Object.assign(new Error("Invalid email or password."), { code: "INVALID_CREDENTIALS", status: 401 });
  }

  // Generate session ID
  const sessionId = uuidv4();

  // Access token payload
  const tokenPayload = {
    sub: String(admin._id),
    sid: sessionId,
    email: admin.email,
    role: admin.role,
    ver: admin.sessionVersion || 1,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken({ ...tokenPayload, remember });

  // Store hashed refresh token
  const refreshExpiry = new Date();
  refreshExpiry.setDate(
    refreshExpiry.getDate() + (remember ? 30 : 7)
  );

  // Add refresh token to list (keep last 5)
  const refreshTokens = (admin.refreshTokens || []).slice(-4);
  refreshTokens.push({
    token: refreshToken,
    createdAt: new Date(),
    expiresAt: refreshExpiry,
    ipAddress: ipAddress || "",
    userAgent: userAgent || "",
  });

  // Update admin record
  await Admin.findByIdAndUpdate(admin._id, {
    $set: {
      lastLogin: new Date(),
      lastLoginIp: ipAddress || "",
      refreshTokens,
    },
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: env.jwtExpiresIn,
    admin: admin.toPublic(),
    session: {
      id: sessionId,
      remember,
      signedInAt: new Date().toISOString(),
    },
  };
}

/**
 * Refresh session using refresh token
 */
export async function refreshSession({ refreshToken, ipAddress, userAgent }) {
  if (!refreshToken) {
    throw Object.assign(new Error("Refresh token is required."), { code: "REFRESH_TOKEN_MISSING", status: 401 });
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw Object.assign(
      new Error(error.name === "TokenExpiredError" ? "Session expired. Please sign in again." : "Invalid refresh token."),
      { code: "INVALID_REFRESH_TOKEN", status: 401 }
    );
  }

  const admin = await Admin.findById(payload.sub).select("+refreshTokens");
  if (!admin || admin.status !== "active") {
    throw Object.assign(new Error("User not found or inactive."), { code: "UNAUTHORIZED", status: 401 });
  }

  // Verify refresh token exists in stored list
  const tokenEntry = (admin.refreshTokens || []).find((t) => t.token === refreshToken);
  if (!tokenEntry || new Date() > tokenEntry.expiresAt) {
    throw Object.assign(new Error("Refresh token revoked or expired."), { code: "INVALID_REFRESH_TOKEN", status: 401 });
  }

  // Check session version
  if (Number(admin.sessionVersion || 1) !== Number(payload.ver || 1)) {
    throw Object.assign(new Error("Session invalidated. Please sign in again."), { code: "SESSION_INVALIDATED", status: 401 });
  }

  // Rotate refresh token
  const sessionId = uuidv4();
  const newPayload = {
    sub: String(admin._id),
    sid: sessionId,
    email: admin.email,
    role: admin.role,
    ver: admin.sessionVersion || 1,
  };

  const newAccessToken = signAccessToken(newPayload);
  const newRefreshToken = signRefreshToken({ ...newPayload, remember: payload.remember });

  // Update stored refresh tokens (replace old with new)
  const updatedTokens = (admin.refreshTokens || [])
    .filter((t) => t.token !== refreshToken)
    .slice(-4);

  const refreshExpiry = new Date();
  refreshExpiry.setDate(refreshExpiry.getDate() + (payload.remember ? 30 : 7));

  updatedTokens.push({
    token: newRefreshToken,
    createdAt: new Date(),
    expiresAt: refreshExpiry,
    ipAddress: ipAddress || "",
    userAgent: userAgent || "",
  });

  await Admin.findByIdAndUpdate(admin._id, { $set: { refreshTokens: updatedTokens } });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresIn: env.jwtExpiresIn,
    session: {
      id: sessionId,
      remember: !!payload.remember,
      signedInAt: new Date().toISOString(),
    },
  };
}

/**
 * Logout - revoke specific refresh token
 */
export async function logout({ adminId, refreshToken }) {
  if (!adminId) return;

  await Admin.findByIdAndUpdate(adminId, {
    $pull: { refreshTokens: { token: refreshToken } },
  });
}

/**
 * Logout All - revoke all refresh tokens (bump session version)
 */
export async function logoutAll({ adminId }) {
  if (!adminId) return;

  await Admin.findByIdAndUpdate(adminId, {
    $set: { refreshTokens: [] },
    $inc: { sessionVersion: 1 },
  });
}

/**
 * Change password
 */
export async function changePassword({ adminId, currentPassword, newPassword }) {
  if (!currentPassword || !newPassword) {
    throw Object.assign(
      new Error("Current password and new password are required."),
      { code: "VALIDATION_ERROR", status: 400 }
    );
  }

  if (newPassword.length < 8) {
    throw Object.assign(
      new Error("New password must be at least 8 characters."),
      { code: "VALIDATION_ERROR", status: 400 }
    );
  }

  const admin = await Admin.findById(adminId).select("+password +refreshTokens");
  if (!admin) {
    throw Object.assign(new Error("Admin not found."), { code: "NOT_FOUND", status: 404 });
  }

  const isValid = await admin.comparePassword(currentPassword);
  if (!isValid) {
    throw Object.assign(new Error("Current password is incorrect."), { code: "INVALID_CREDENTIALS", status: 400 });
  }

  admin.password = newPassword;
  admin.refreshTokens = []; // Invalidate all sessions
  await admin.save();

  return { message: "Password changed successfully. Please sign in again." };
}
