import rateLimit from "express-rate-limit";

/**
 * Rate Limiters
 */

// General API rate limit
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests. Please try again after 15 minutes.",
  },
});

// Auth rate limit (strict)
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 login attempts per 15 minutes
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "RATE_LIMIT_EXCEEDED",
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
});
