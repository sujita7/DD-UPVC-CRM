import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

function required(key) {
  const value = process.env[key];
  if (!value) throw new Error(`Environment variable ${key} is required`);
  return value;
}

function optional(key, defaultValue = "") {
  return process.env[key] || defaultValue;
}

export const env = {
  port: parseInt(optional("PORT", "5000"), 10),
  nodeEnv: optional("NODE_ENV", "development"),
  isDevelopment: optional("NODE_ENV", "development") === "development",
  isProduction: optional("NODE_ENV", "development") === "production",

  // Database (MySQL)
  dbDialect: optional("DB_DIALECT", "mysql"),
  dbHost: optional("DB_HOST", "localhost"),
  dbPort: parseInt(optional("DB_PORT", "3306"), 10),
  dbUser: optional("DB_USER", "root"),
  dbPassword: optional("DB_PASSWORD", ""),
  dbName: optional("DB_NAME", "crm_db"),

  // Legacy MongoDB (if needed)
  mongoUri: optional("MONGO_URI", "mongodb://localhost:27017/crm_db"),

  // JWT
  jwtSecret: optional("JWT_SECRET", "crm_dev_secret_key_min_32_chars_here!!"),
  jwtExpiresIn: optional("JWT_EXPIRES_IN", "7d"),
  jwtRefreshSecret: optional("JWT_REFRESH_SECRET", "crm_dev_refresh_secret_key_32_chars!"),
  jwtRefreshExpiresIn: optional("JWT_REFRESH_EXPIRES_IN", "30d"),

  // Cookie
  cookieSecret: optional("COOKIE_SECRET", "crm_cookie_secret"),

  // CORS
  clientUrl: optional("CLIENT_URL", "http://localhost:3000"),

  // Email
  smtpHost: optional("SMTP_HOST", "smtp.gmail.com"),
  smtpPort: parseInt(optional("SMTP_PORT", "587"), 10),
  smtpUser: optional("SMTP_USER", ""),
  smtpPass: optional("SMTP_PASS", ""),

  // Uploads
  uploadDir: optional("UPLOAD_DIR", "uploads"),
  maxFileSize: parseInt(optional("MAX_FILE_SIZE", "10485760"), 10),
};
