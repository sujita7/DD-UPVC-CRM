# DD UPVC ERP & CRM System

An enterprise-grade ERP, CRM, and Factory Workshop Operations platform purpose-built for uPVC window and door manufacturing, fabrication management, commercial operations, accounting, and workforce administration.

Developed for **DD UPVC WINDOW SYSTEMS** (Prominance Certified Manufacturer).

---

## 🛠️ Technology Stack

### Frontend (`/admin`)
- **Framework**: [React 18](https://react.dev/) + [Vite 6](https://vitejs.dev/)
- **Routing**: [React Router DOM v7](https://reactrouter.com/)
- **UI & Component System**: [Ant Design (antd v5)](https://ant.design/) + Custom Enterprise Theme Tokens & Glassmorphism Styling
- **Visual Analytics**: [Recharts](https://recharts.org/)
- **Date Utility**: [Day.js](https://day.js.org/)
- **API Client**: [Axios](https://axios-http.com/) with automated JWT interceptors & token refresh

### Backend (`/backend`)
- **Runtime**: [Node.js](https://nodejs.org/) (ES Modules)
- **Framework**: [Express.js](https://expressjs.com/)
- **Database Engine**: [MySQL](https://www.mysql.com/) with `mysql2/promise` connection pooling
- **Data Abstraction**: Universal Relational Engine with auto-indexing and JSON-serialized column mapping
- **Security & Middleware**: [Helmet](https://helmetjs.github.io/), CORS, Cookie-Parser, Express-Rate-Limit, BCrypt.js, Zod
- **Authentication**: Dual-token JWT (Access Token + secure httpOnly Refresh Cookie with rotation)
- **Document / Email Delivery**: [Nodemailer](https://nodemailer.com/) (SMTP support for customer invoices and quotes)

---

## 📁 Folder Structure

```
DD-UPVC-CRM/
├── admin/                         # Frontend Application (React + Vite)
│   ├── public/                    # Static branding assets & company logos
│   ├── src/
│   │   ├── components/            # Reusable UI components
│   │   │   ├── layout/            # AppLayout, responsive sidebar & topbar
│   │   │   ├── ProformaInvoiceTemplate.jsx  # Printable Quotation/Proforma/Invoice template
│   │   │   └── Sidebar.jsx        # Modular navigation links
│   │   ├── context/               # React Context (AuthContext for session restoration)
│   │   ├── data/                  # Prominance uPVC profiles, windows catalogue & specifications
│   │   ├── pages/                 # Full-featured application views
│   │   │   ├── Dashboard.jsx      # Telemetry, revenue analytics & order pipeline
│   │   │   ├── Customers.jsx      # Customer directory & Accounts Receivable ledger
│   │   │   ├── Quotations.jsx     # Window & raw material costing with 1-click invoice conversion
│   │   │   ├── SalesOrders.jsx    # Work orders, tentative/final fulfillment measurement
│   │   │   ├── Proforma.jsx       # Proforma invoice generation & print preview
│   │   │   ├── Production.jsx     # Factory floor fabrication queue, cutting sheets & Job Cards
│   │   │   ├── Suppliers.jsx      # Vendor directory & Accounts Payable ledger
│   │   │   ├── Invoices.jsx       # GST Tax invoices with settlement status (Due, Settle, Paid)
│   │   │   ├── Expenses.jsx       # Daily operating and project expense ledger
│   │   │   ├── Employees.jsx      # Staff registry, salary structures & bank details
│   │   │   ├── Attendance.jsx     # Daily workforce attendance roster & work hours
│   │   │   ├── Payroll.jsx        # Attendance-driven payroll engine with advance deductions
│   │   │   ├── AdvancePayment.jsx # Employee advance payment tracker & deduction sync
│   │   │   ├── Tasks.jsx          # Workflow tasks and approval tracker
│   │   │   ├── Settings.jsx       # Dynamic company profile, GSTIN & multi-bank accounts
│   │   │   └── Login.jsx          # Secure admin login
│   │   ├── services/              # Centralized Axios API services
│   │   ├── styles/                # CSS design system (tokens, themes, tables & pills)
│   │   ├── App.jsx                # Protected route declarations
│   │   └── main.jsx               # React entry point with theme ConfigProvider
│   ├── index.html                 # Single page application HTML shell
│   ├── package.json               # Frontend dependencies & Vite scripts
│   └── vite.config.js             # Vite configuration with local proxy
│
├── backend/                       # REST API Backend (Node.js + Express + MySQL)
│   ├── src/
│   │   ├── config/                # Database pooling & environment variables
│   │   │   ├── db.js              # MySQL connection pool initialization
│   │   │   ├── env.js             # Environment variable validation
│   │   │   └── mysqlInit.js       # Auto-table creation & safe schema migrations
│   │   ├── middleware/            # Auth verification (JWT), RBAC & error handlers
│   │   ├── models/                # Universal MySQL model registry (Mongoose-compatible API)
│   │   │   └── mysqlModel.js      # Universal query builder & JSON serializer
│   │   ├── routes/                # Express API modular endpoints
│   │   │   ├── auth.js            # Sign in, token refresh, logout & profile
│   │   │   ├── customers.js       # Customer CRUD & AR ledger balance
│   │   │   ├── quotations.js      # Quotation calculations & convert-to-invoice
│   │   │   ├── salesOrders.js     # Sales order pipeline & status management
│   │   │   ├── invoices.js        # GST invoice generation, balance due & payments
│   │   │   ├── advancePayments.js # Advance payment tracking & payroll deduction sync
│   │   │   ├── payroll.js         # Attendance & advance deduction salary processing
│   │   │   ├── employees.js       # Employee management
│   │   │   ├── attendance.js      # Attendance logging & monthly statistics
│   │   │   ├── expenses.js        # Operating expenses ledger
│   │   │   ├── suppliers.js       # Vendor management & AP ledger
│   │   │   ├── dashboard.js       # Executive KPI metrics & financial telemetry
│   │   │   └── settings.js        # Dynamic company settings & multi-bank registry
│   │   ├── scripts/               # Database seeder scripts
│   │   └── index.js               # Express application entry point
│   ├── .env.example               # Template environment configuration
│   └── package.json               # Backend dependencies & scripts
│
├── .gitignore                     # Git ignore rules for node_modules, builds & secrets
├── package.json                   # Root monorepo workspace runner
└── README.md                      # Complete system documentation
```

---

## ⚡ Core Modules & Features

1. **Commercial & Quotations**:
   - Multi-window costing engine with custom width/height (mm), calculated sq.ft, glass specifications, sash type, and mesh.
   - Prominance raw materials & profile catalog with per-meter rates.
   - 1-click conversion from **Quotation ➔ Proforma Invoice ➔ Tax Invoice**.
2. **Sales & Fulfillment**:
   - Order pipeline tracking with **Fulfillment Measurement** (`Tentative` vs `Final`).
   - Advance payment tracking and live balance due computation.
   - Search & filtering by order status (`Confirmed`, `In Production`, `Ready`, `Dispatched`, `Delivered`, `Final`, `Tentative`).
3. **Production & Factory Floor**:
   - Real-time fabrication queue showing active orders in production.
   - **Dynamic Job Cards & Cutting Sheets**:
     - Window dimensions (Width × Height mm), quantity, and unit sq. ft.
     - **Dynamic Workshop Notes**: Editable instructions for cutting, reinforcement, and glass specifications.
     - **Dynamic Quality Inspection Sign-off**: Supervisor signature (`✍ Name`), dynamic inspection date, and official QC approval seal.
     - Print-ready format via `window.print()` for shop floor workers.
4. **Finance & Invoicing**:
   - GST compliant tax invoices with customizable rates (18% GST).
   - Settlement status tracking: **`Due`**, **`Settle`**, **`Partially Paid`**, **`Paid`**, and **`Overdue`**.
   - Operating expense register with real-time category totals.
5. **Workforce, Attendance & Payroll**:
   - Daily attendance roster (`Present`, `Absent`, `Half-Day`, `Late`, `Leave`).
   - **Employee Advance Payment**: Manually record employee advance payments with optional notes and dates.
   - **Automated Payroll Deductions**: Advance payments are automatically deducted from net salary upon payroll generation.
6. **Company Profile & Multi-Bank Management**:
   - Fully dynamic company legal name, display name, address, phone, email, and GSTIN.
   - Support for multiple bank accounts (SBI, HDFC, etc.) with default account selection for invoice printouts.

---

## 📋 Prerequisites

Before running the project, ensure you have the following installed on your machine:

1. **Node.js**: `v18.0.0` or higher ([Download Node.js](https://nodejs.org/))
2. **npm** (comes bundled with Node.js) or **pnpm** / **yarn**
3. **MySQL Server**: `v8.0` or higher ([Download MySQL](https://dev.mysql.com/downloads/mysql/)) or MariaDB running on port `3306`
4. **Git**: Installed for version control ([Download Git](https://git-scm.com/))

---

## 🚀 Step-by-Step Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/sujita7/DD-UPVC-CRM.git
cd DD-UPVC-CRM
```

### 2. Configure Environment Variables
Navigate to the `backend/` directory and copy `.env.example` to `.env`:

```bash
# On Windows PowerShell:
Copy-Item backend/.env.example backend/.env

# On Linux / macOS:
cp backend/.env.example backend/.env
```

Open `backend/.env` and update your MySQL credentials:

```env
PORT=5000
NODE_ENV=development

# MySQL Database Connection
DB_DIALECT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=crm_db

# JWT & Cookie Secrets
JWT_SECRET=dd_upvc_crm_jwt_super_secret_key_min_32_chars_2026
JWT_REFRESH_SECRET=dd_upvc_crm_jwt_refresh_secret_key_32_chars_2026
COOKIE_SECRET=dd_upvc_crm_cookie_secret_key

# Frontend Client URL
CLIENT_URL=http://localhost:3000
```

> **Note**: The backend automatically executes `CREATE DATABASE IF NOT EXISTS crm_db` and runs automated table schema migrations on startup.

---

### 3. Install Dependencies

You can install all dependencies from the root directory:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../admin
npm install

# Return to root directory
cd ..
```

---

### 4. Seed Initial Data (Optional)
To populate the database with default admin credentials, Prominance uPVC product catalog, demo customers, and employees:

```bash
npm run seed
# or:
cd backend && npm run seed
```

---

### 5. Start the Application

You can start both backend and frontend servers in separate terminal windows:

#### Terminal 1: Backend Server (Port 5000)
```bash
# From root:
npm run backend

# Or inside backend/:
cd backend
npm run dev
```
> Backend runs at: `http://localhost:5000`

#### Terminal 2: Admin Portal Frontend (Port 3000)
```bash
# From root:
npm run admin

# Or inside admin/:
cd admin
npm run dev
```
> Admin portal runs at: `http://localhost:3000`

---

### 6. Building for Production

To create an optimized production build of the admin portal:

```bash
# From root:
npm run build:admin

# Or inside admin/:
cd admin
npm run build
```
The compiled output will be generated in `admin/dist/`.

---

## 🔐 Default Access & Credentials

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@ddupvc.com` | `Admin@1234` | Full access across all commercial, financial, factory, and HR modules |

---

## 📜 Available NPM Scripts (Root)

| Script | Command | Description |
| :--- | :--- | :--- |
| `npm run backend` | `npm --prefix backend run dev` | Starts Express backend in watch mode on port `5000` |
| `npm run admin` | `npm --prefix admin run dev` | Starts Vite React frontend on port `3000` |
| `npm run seed` | `npm --prefix backend run seed` | Seeds MySQL database with default products, admin, and demo data |
| `npm run build:admin` | `npm --prefix admin run build` | Compiles production assets into `admin/dist/` |

---

## 📄 License & Ownership
Copyright © 2026 **DD UPVC WINDOW SYSTEMS**. All rights reserved.
Developed by ** Sujita Kumari** (`sujita.kri07@gmail.com`).
