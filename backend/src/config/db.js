import mysql from "mysql2/promise";
import { env } from "./env.js";
import { initMySQLTables } from "./mysqlInit.js";

let pool = null;

export async function connectDB() {
  const host = env.dbHost || "localhost";
  const port = env.dbPort || 3306;
  const user = env.dbUser || "root";
  const password = env.dbPassword || "";
  const database = env.dbName || "crm_db";

  console.log(`🔌 Connecting to MySQL at ${host}:${port} as ${user}...`);

  // Step 1: Connect to MySQL server and ensure database exists
  try {
    const initConn = await mysql.createConnection({
      host,
      port,
      user,
      password,
    });
    await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await initConn.end();
  } catch (err) {
    console.error("⚠️  Could not auto-create MySQL database (might lack permissions or already exist):", err.message);
  }

  // Step 2: Create connection pool for the CRM database
  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  });

  // Test pool connection
  const testConn = await pool.getConnection();
  console.log(`✅ MySQL connected successfully to database: ${database} (${host}:${port})`);
  testConn.release();

  // Step 3: Ensure all 11 tables and indexes exist
  await initMySQLTables(pool);

  return pool;
}

export function getMySQLPool() {
  if (!pool) {
    throw new Error("MySQL database pool is not connected. Call connectDB() first.");
  }
  return pool;
}

export async function disconnectDB() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("🔌 MySQL pool closed");
  }
}

export function dbState() {
  return {
    status: pool ? "connected" : "disconnected",
    dialect: "mysql",
    database: env.dbName || "crm_db",
  };
}
