/**
 * Error Handler Middleware
 * Central error handling for the CRM API.
 */

export function errorHandler(err, req, res, next) {
  console.error("Error:", {
    message: err.message,
    code: err.code,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
  });

  // Known application errors
  if (err.code === "VALIDATION_ERROR") {
    return res.status(err.status || 400).json({
      error: "VALIDATION_ERROR",
      message: err.message,
    });
  }

  if (err.code === "INVALID_CREDENTIALS") {
    return res.status(401).json({
      error: "INVALID_CREDENTIALS",
      message: err.message,
    });
  }

  if (err.code === "UNAUTHORIZED") {
    return res.status(401).json({
      error: "UNAUTHORIZED",
      message: err.message,
    });
  }

  if (err.code === "FORBIDDEN") {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: err.message,
    });
  }

  if (err.code === "NOT_FOUND") {
    return res.status(404).json({
      error: "NOT_FOUND",
      message: err.message,
    });
  }

  if (err.code === "CONFLICT") {
    return res.status(409).json({
      error: "CONFLICT",
      message: err.message,
    });
  }

  // Mongoose validation errors
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Validation failed.",
      details: messages,
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    const value = Object.values(err.keyValue || {})[0];
    return res.status(409).json({
      error: "DUPLICATE_KEY",
      message: `${field} '${value}' already exists.`,
      field,
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({
      error: "INVALID_ID",
      message: `Invalid value for field: ${err.path}`,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ error: "INVALID_TOKEN", message: "Invalid token." });
  }
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ error: "TOKEN_EXPIRED", message: "Session expired. Please sign in again." });
  }

  // Generic server error
  return res.status(err.status || 500).json({
    error: "SERVER_ERROR",
    message: process.env.NODE_ENV === "development" ? err.message : "An internal server error occurred.",
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: "NOT_FOUND",
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
}
