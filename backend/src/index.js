import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiRateLimit } from "./middleware/rateLimiter.js";

// Routes
import authRouter from "./routes/auth.js";
import adminsRouter from "./routes/admins.js";
import dashboardRouter from "./routes/dashboard.js";
import employeesRouter from "./routes/employees.js";
import attendanceRouter from "./routes/attendance.js";
import payrollRouter from "./routes/payroll.js";
import customersRouter from "./routes/customers.js";
import suppliersRouter from "./routes/suppliers.js";
import paymentsRouter from "./routes/payments.js";
import invoicesRouter from "./routes/invoices.js";
import quotationsRouter from "./routes/quotations.js";
import holidaysRouter from "./routes/holidays.js";
import tasksRouter from "./routes/tasks.js";
import salesOrdersRouter from "./routes/salesOrders.js";
import productsRouter from "./routes/products.js";
import settingsRouter from "./routes/settings.js";
import expensesRouter from "./routes/expenses.js";
import advancePaymentsRouter from "./routes/advancePayments.js";

// ──────────────────────────────────────────────────────────────────────────────
// Express App Setup
// ──────────────────────────────────────────────────────────────────────────────

const app = express();

// Trust proxy (for rate limiting, IP detection behind Nginx/load balancer)
app.set("trust proxy", 1);

// ──────────────────────────────────────────────────────────────────────────────
// Security Middleware
// ──────────────────────────────────────────────────────────────────────────────

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-id"],
  })
);

// ──────────────────────────────────────────────────────────────────────────────
// General Middleware
// ──────────────────────────────────────────────────────────────────────────────

app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser(env.cookieSecret));

if (env.isDevelopment) {
  app.use(morgan("dev"));
}

// Global rate limit
app.use("/api", apiRateLimit);

// ──────────────────────────────────────────────────────────────────────────────
// Health Check (no auth required)
// ──────────────────────────────────────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "CRM Admin API",
    version: "1.0.0",
    environment: env.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// API Routes
// ──────────────────────────────────────────────────────────────────────────────

app.use(authRouter);       // /api/auth/*, /api/me
app.use(adminsRouter);     // /api/admins/*
app.use(dashboardRouter);  // /api/dashboard
app.use(employeesRouter);  // /api/employees/*
app.use(attendanceRouter); // /api/attendance/*
app.use(payrollRouter);    // /api/payroll/*
app.use(customersRouter);  // /api/customers/*
app.use(suppliersRouter);  // /api/suppliers/*
app.use(paymentsRouter);   // /api/payments/*
app.use(invoicesRouter);   // /api/invoices/*
app.use(quotationsRouter); // /api/quotations/*
app.use(holidaysRouter);   // /api/holidays/*
app.use(tasksRouter);      // /api/tasks/*
app.use(salesOrdersRouter);// /api/sales-orders/*
app.use(productsRouter);   // /api/products/*
app.use(settingsRouter);   // /api/settings/*
app.use(expensesRouter);   // /api/expenses/*
app.use(advancePaymentsRouter); // /api/advance-payments/*

// ──────────────────────────────────────────────────────────────────────────────
// 404 & Error Handlers
// ──────────────────────────────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

// ──────────────────────────────────────────────────────────────────────────────
// Server Start
// ──────────────────────────────────────────────────────────────────────────────

async function startServer() {
  try {
    await connectDB();

    const server = app.listen(env.port, () => {
      console.log(`\n🚀 CRM Admin API Server running on port ${env.port}`);
      console.log(`📍 Environment: ${env.nodeEnv}`);
      console.log(`🌐 API URL: http://localhost:${env.port}/api`);
      console.log(`❤️  Health: http://localhost:${env.port}/api/health\n`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n⚠️  ${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        const { disconnectDB } = await import("./config/db.js");
        await disconnectDB();
        console.log("✅ Server shut down gracefully.");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    return server;
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

export default app;
