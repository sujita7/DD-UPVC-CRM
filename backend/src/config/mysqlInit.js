/**
 * MySQL Database Schema Initialization
 * Automatically creates all tables, columns, and indexes for the CRM system.
 */

export async function initMySQLTables(pool) {
  const connection = await pool.getConnection();
  try {
    // 1. Admins Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(191) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        permissions LONGTEXT,
        phone VARCHAR(50),
        avatar VARCHAR(255),
        department VARCHAR(100),
        designation VARCHAR(100),
        status VARCHAR(50) DEFAULT 'active',
        sessionVersion INT DEFAULT 1,
        lastLogin DATETIME,
        lastLoginIp VARCHAR(50),
        passwordChangedAt DATETIME,
        refreshTokens LONGTEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_admins_email (email),
        INDEX idx_admins_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Employees Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id VARCHAR(36) PRIMARY KEY,
        employeeId VARCHAR(50) UNIQUE,
        firstName VARCHAR(100) NOT NULL,
        lastName VARCHAR(100) NOT NULL,
        email VARCHAR(191) UNIQUE,
        phone VARCHAR(50),
        alternatePhone VARCHAR(50),
        avatar VARCHAR(255),
        department VARCHAR(100) DEFAULT 'General',
        designation VARCHAR(100) DEFAULT 'Employee',
        paidLeaves INT DEFAULT 0,
        employmentType VARCHAR(50) DEFAULT 'full-time',
        joinDate DATETIME,
        endDate DATETIME,
        salary LONGTEXT,
        currency VARCHAR(10) DEFAULT 'INR',
        salaryFrequency VARCHAR(50) DEFAULT 'monthly',
        bankDetails LONGTEXT,
        address LONGTEXT,
        documents LONGTEXT,
        emergencyContact LONGTEXT,
        status VARCHAR(50) DEFAULT 'active',
        notes TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_employees_dept (department),
        INDEX idx_employees_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Customers Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(36) PRIMARY KEY,
        customerId VARCHAR(50) UNIQUE,
        type VARCHAR(50) DEFAULT 'company',
        name VARCHAR(191) NOT NULL,
        companyName VARCHAR(191),
        email VARCHAR(191),
        phone VARCHAR(50),
        alternatePhone VARCHAR(50),
        website VARCHAR(255),
        gstNumber VARCHAR(50),
        panNumber VARCHAR(50),
        taxNumber VARCHAR(100),
        billingAddress LONGTEXT,
        shippingAddress LONGTEXT,
        address LONGTEXT,
        contactPerson LONGTEXT,
        category VARCHAR(100),
        tags LONGTEXT,
        creditLimit DECIMAL(15,2) DEFAULT 0,
        creditPeriod INT DEFAULT 30,
        paymentTerms INT DEFAULT 30,
        openingBalance DECIMAL(15,2) DEFAULT 0,
        currentBalance DECIMAL(15,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'active',
        source VARCHAR(100),
        notes TEXT,
        createdBy VARCHAR(36),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_customers_name (name),
        INDEX idx_customers_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Suppliers Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id VARCHAR(36) PRIMARY KEY,
        supplierId VARCHAR(50) UNIQUE,
        type VARCHAR(50) DEFAULT 'company',
        name VARCHAR(191) NOT NULL,
        companyName VARCHAR(191),
        email VARCHAR(191),
        phone VARCHAR(50),
        alternatePhone VARCHAR(50),
        website VARCHAR(255),
        gstNumber VARCHAR(50),
        panNumber VARCHAR(50),
        taxNumber VARCHAR(100),
        msmeNumber VARCHAR(50),
        tdsRate DECIMAL(5,2) DEFAULT 0,
        address LONGTEXT,
        contactPerson LONGTEXT,
        bankDetails LONGTEXT,
        category VARCHAR(100),
        tags LONGTEXT,
        openingBalance DECIMAL(15,2) DEFAULT 0,
        currentBalance DECIMAL(15,2) DEFAULT 0,
        paymentTerms VARCHAR(100) DEFAULT 'net-30',
        status VARCHAR(50) DEFAULT 'active',
        notes TEXT,
        createdBy VARCHAR(36),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_suppliers_name (name),
        INDEX idx_suppliers_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Quotations Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS quotations (
        id VARCHAR(36) PRIMARY KEY,
        quotationNumber VARCHAR(50) UNIQUE,
        customer VARCHAR(36) NOT NULL,
        customerSnapshot LONGTEXT,
        projectName VARCHAR(191),
        quotationDate DATETIME,
        validUntil DATETIME,
        items LONGTEXT,
        subtotal DECIMAL(15,2) DEFAULT 0,
        discountType VARCHAR(20) DEFAULT 'percentage',
        discountValue DECIMAL(15,2) DEFAULT 0,
        discountAmount DECIMAL(15,2) DEFAULT 0,
        taxAmount DECIMAL(15,2) DEFAULT 0,
        totalAmount DECIMAL(15,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'draft',
        notes TEXT,
        termsAndConditions TEXT,
        invoice VARCHAR(36),
        convertedAt DATETIME,
        createdBy VARCHAR(36),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_quotations_cust (customer),
        INDEX idx_quotations_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Invoices Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id VARCHAR(36) PRIMARY KEY,
        invoiceNumber VARCHAR(50) UNIQUE,
        invoiceType VARCHAR(50) DEFAULT 'tax-invoice',
        customer VARCHAR(36) NOT NULL,
        customerSnapshot LONGTEXT,
        quotation VARCHAR(36),
        invoiceDate DATETIME,
        dueDate DATETIME,
        items LONGTEXT,
        subtotal DECIMAL(15,2) DEFAULT 0,
        discountType VARCHAR(20) DEFAULT 'percentage',
        discountValue DECIMAL(15,2) DEFAULT 0,
        discountAmount DECIMAL(15,2) DEFAULT 0,
        taxAmount DECIMAL(15,2) DEFAULT 0,
        shippingCharges DECIMAL(15,2) DEFAULT 0,
        roundOff DECIMAL(15,2) DEFAULT 0,
        totalAmount DECIMAL(15,2) DEFAULT 0,
        paidAmount DECIMAL(15,2) DEFAULT 0,
        balanceAmount DECIMAL(15,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'unpaid',
        paymentTerms VARCHAR(100) DEFAULT 'net-30',
        notes TEXT,
        termsAndConditions TEXT,
        bankDetails LONGTEXT,
        payments LONGTEXT,
        createdBy VARCHAR(36),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_invoices_cust (customer),
        INDEX idx_invoices_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Payments Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(36) PRIMARY KEY,
        paymentId VARCHAR(50) UNIQUE,
        paymentType VARCHAR(50) NOT NULL,
        partyType VARCHAR(50) NOT NULL,
        customer VARCHAR(36),
        supplier VARCHAR(36),
        employee VARCHAR(36),
        partyName VARCHAR(191) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        paymentMethod VARCHAR(50) NOT NULL,
        paymentDate DATETIME,
        referenceNumber VARCHAR(100),
        invoices LONGTEXT,
        bankAccount VARCHAR(100),
        status VARCHAR(50) DEFAULT 'completed',
        notes TEXT,
        receipt LONGTEXT,
        createdBy VARCHAR(36),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_payments_type (paymentType),
        INDEX idx_payments_cust (customer),
        INDEX idx_payments_supp (supplier),
        INDEX idx_payments_emp (employee)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. Attendances Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS attendances (
        id VARCHAR(36) PRIMARY KEY,
        employee VARCHAR(36) NOT NULL,
        employeeId VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        status VARCHAR(50) NOT NULL,
        checkIn DATETIME,
        checkOut DATETIME,
        workHours DECIMAL(6,2) DEFAULT 0,
        overtimeHours DECIMAL(6,2) DEFAULT 0,
        overtimePayRate DECIMAL(10,2) DEFAULT 15,
        standardHours DECIMAL(6,2) DEFAULT 8,
        lateMinutes INT DEFAULT 0,
        leaveDetails LONGTEXT,
        notes TEXT,
        markedBy VARCHAR(36),
        isManual BOOLEAN DEFAULT FALSE,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_attendances_emp (employee),
        INDEX idx_attendances_date (date),
        INDEX idx_attendances_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. Payrolls Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS payrolls (
        id VARCHAR(36) PRIMARY KEY,
        payrollId VARCHAR(50) UNIQUE,
        employee VARCHAR(36) NOT NULL,
        employeeId VARCHAR(50) NOT NULL,
        employeeName VARCHAR(191) NOT NULL,
        month INT NOT NULL,
        year INT NOT NULL,
        payPeriod LONGTEXT,
        attendance LONGTEXT,
        earnings LONGTEXT,
        deductions LONGTEXT,
        grossSalary DECIMAL(15,2) DEFAULT 0,
        totalDeductions DECIMAL(15,2) DEFAULT 0,
        netSalary DECIMAL(15,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'draft',
        paymentStatus VARCHAR(50) DEFAULT 'unpaid',
        paymentMethod VARCHAR(50),
        paymentDate DATETIME,
        paymentRef VARCHAR(100),
        paymentReference VARCHAR(100),
        approvedAt DATETIME,
        notes TEXT,
        createdBy VARCHAR(36),
        approvedBy VARCHAR(36),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_payrolls_emp (employee),
        INDEX idx_payrolls_period (year, month)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 10. Holidays Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS holidays (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(191) NOT NULL,
        date DATE NOT NULL UNIQUE,
        description TEXT,
        isOptional BOOLEAN DEFAULT FALSE,
        createdBy VARCHAR(36),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_holidays_date (date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 11. Tasks Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(36) PRIMARY KEY,
        taskId VARCHAR(50) UNIQUE,
        title VARCHAR(255) NOT NULL,
        dueDate DATE NOT NULL,
        dueTime VARCHAR(20) DEFAULT '18:00',
        priority VARCHAR(20) DEFAULT 'medium',
        status VARCHAR(20) DEFAULT 'pending',
        notes TEXT,
        category VARCHAR(100) DEFAULT 'General',
        assignedTo VARCHAR(100) DEFAULT 'Admin',
        completedAt DATETIME,
        createdBy VARCHAR(36),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tasks_status (status),
        INDEX idx_tasks_duedate (dueDate)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 12. Sales Orders Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sales_orders (
        id VARCHAR(36) PRIMARY KEY,
        orderNumber VARCHAR(50) UNIQUE,
        customer VARCHAR(36) NOT NULL,
        customerSnapshot LONGTEXT,
        projectName VARCHAR(191),
        orderDate DATETIME,
        deliveryDate DATETIME,
        items LONGTEXT,
        subtotal DECIMAL(15,2) DEFAULT 0,
        taxAmount DECIMAL(15,2) DEFAULT 0,
        totalAmount DECIMAL(15,2) DEFAULT 0,
        advancePaid DECIMAL(15,2) DEFAULT 0,
        balanceDue DECIMAL(15,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'confirmed',
        fulfillmentMeasurement VARCHAR(50) DEFAULT 'tentative',
        quotation VARCHAR(36),
        proforma VARCHAR(36),
        notes TEXT,
        createdBy VARCHAR(36),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_orders_cust (customer),
        INDEX idx_orders_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 13. Products & Profiles Catalogue Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(36) PRIMARY KEY,
        productCode VARCHAR(50) UNIQUE,
        series VARCHAR(50) NOT NULL,
        name VARCHAR(191) NOT NULL,
        category VARCHAR(100) NOT NULL,
        profileLength DECIMAL(6,2) DEFAULT 5.8,
        piecesPerPacket INT DEFAULT 1,
        unit VARCHAR(20) DEFAULT 'meter',
        pricePerMeter DECIMAL(10,2) DEFAULT 0,
        pricePerPiece DECIMAL(10,2) DEFAULT 0,
        pricePerSqFt DECIMAL(10,2) DEFAULT 0,
        dimensions VARCHAR(100),
        color VARCHAR(50) DEFAULT 'White PWH',
        specifications LONGTEXT,
        status VARCHAR(20) DEFAULT 'active',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_products_series (series),
        INDEX idx_products_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 14. Company Settings & Dynamic Bank Details Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS company_settings (
        id VARCHAR(36) PRIMARY KEY,
        companyLegalName VARCHAR(191) DEFAULT 'DD UPVC WINDOW SYSTEMS',
        displayName VARCHAR(191) DEFAULT 'DD UPVC',
        companyTitle VARCHAR(191) DEFAULT 'DD UPVC WINDOWS',
        address TEXT,
        city VARCHAR(100) DEFAULT 'Shahdol',
        state VARCHAR(100) DEFAULT 'Madhya Pradesh',
        pincode VARCHAR(20) DEFAULT '',
        phone VARCHAR(50) DEFAULT '+91 9826414729',
        email VARCHAR(191) DEFAULT 'ddupvcwindowsystem@gmail.com',
        businessEmail VARCHAR(191) DEFAULT 'ddupvcwindowsystem@gmail.com',
        gstin VARCHAR(50) DEFAULT '23EVFPG6600A1ZB',
        invoicePrefix VARCHAR(20) DEFAULT 'INV-',
        quotationPrefix VARCHAR(20) DEFAULT 'QT-',
        proformaPrefix VARCHAR(20) DEFAULT 'PI-',
        financialYear VARCHAR(50) DEFAULT '2026–27',
        whatsappSender VARCHAR(50) DEFAULT '+91 9826414729',
        bankDetails LONGTEXT,
        termsAndConditions TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 15. Expenses Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id VARCHAR(36) PRIMARY KEY,
        expenseId VARCHAR(50) UNIQUE,
        title VARCHAR(255) NOT NULL,
        amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        expenseDate DATE NOT NULL,
        category VARCHAR(100) DEFAULT 'General',
        paymentMethod VARCHAR(50) DEFAULT 'Cash',
        paidTo VARCHAR(191),
        notes TEXT,
        receipt VARCHAR(255),
        createdBy VARCHAR(36),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_expenses_date (expenseDate),
        INDEX idx_expenses_cat (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 16. Employee Advance Payments Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS advance_payments (
        id VARCHAR(36) PRIMARY KEY,
        advanceId VARCHAR(50) UNIQUE,
        employee VARCHAR(36) NOT NULL,
        employeeId VARCHAR(50),
        employeeName VARCHAR(191),
        amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        paymentDate DATE NOT NULL,
        month INT,
        year INT,
        paymentMethod VARCHAR(50) DEFAULT 'Cash',
        notes TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        payrollId VARCHAR(36),
        createdBy VARCHAR(36),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_adv_emp (employee),
        INDEX idx_adv_date (paymentDate),
        INDEX idx_adv_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Initialize default company settings if table empty
    try {
      const [existingSettings] = await connection.query(`SELECT id FROM company_settings LIMIT 1`);
      if (existingSettings.length === 0) {
        const defaultBankDetails = JSON.stringify([
          {
            id: "bank-1",
            bankName: "State Bank of India (SBI)",
            accountHolder: "DD UPVC WINDOW SYSTEMS",
            accountNumber: "44250720832",
            ifscCode: "SBIN0061553",
            branch: "Medical College Shahdol M.P.",
            isDefault: true,
          },
        ]);
        await connection.query(`
          INSERT INTO company_settings (
            id, companyLegalName, displayName, companyTitle, address, city, state, phone, email, businessEmail, gstin, invoicePrefix, quotationPrefix, proformaPrefix, financialYear, whatsappSender, bankDetails
          ) VALUES (
            'default-settings', 'DD UPVC WINDOW SYSTEMS', 'DD UPVC', 'DD UPVC WINDOWS', 'Kudri(Medical College Road), Shahdol, M.P.', 'Shahdol', 'Madhya Pradesh', '+91 9826414729', 'ddupvcwindowsystem@gmail.com', 'ddupvcwindowsystem@gmail.com', '23EVFPG6600A1ZB', 'INV-', 'QT-', 'PI-', '2026–27', '+91 9826414729', ?
          )
        `, [defaultBankDetails]);
      }
    } catch (e) {
      console.warn("Could not pre-seed company_settings:", e.message);
    }

    // ── Safe Schema Upgrades for Existing Tables ─────────────────────────────
    const safeAddColumn = async (table, column, def) => {
      try {
        const [rows] = await connection.query(`
          SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
        `, [table, column]);
        if (rows.length === 0) {
          await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${def}`);
        }
      } catch (e) {
        // ignore if already exists or fails gracefully
      }
    };

    await safeAddColumn("customers", "taxNumber", "VARCHAR(100)");
    await safeAddColumn("customers", "paymentTerms", "INT DEFAULT 30");
    await safeAddColumn("customers", "address", "LONGTEXT");
    await safeAddColumn("customers", "source", "VARCHAR(100)");

    await safeAddColumn("suppliers", "taxNumber", "VARCHAR(100)");

    await safeAddColumn("quotations", "projectName", "VARCHAR(191)");
    await safeAddColumn("quotations", "emailSentTo", "VARCHAR(191)");
    await safeAddColumn("quotations", "emailSentAt", "DATETIME");
    await safeAddColumn("quotations", "specifications", "LONGTEXT");
    await safeAddColumn("quotations", "bankDetails", "LONGTEXT");
    await safeAddColumn("quotations", "companyGstin", "VARCHAR(50)");
    await safeAddColumn("quotations", "clientAddress", "TEXT");
    await safeAddColumn("quotations", "clientCity", "VARCHAR(100)");
    await safeAddColumn("quotations", "clientState", "VARCHAR(100)");
    await safeAddColumn("quotations", "clientGst", "VARCHAR(50)");
    await safeAddColumn("quotations", "rawMaterials", "LONGTEXT");
    await safeAddColumn("quotations", "discountPercentage", "DECIMAL(5,2) DEFAULT 0");

    await safeAddColumn("invoices", "paymentStatus", "VARCHAR(50) DEFAULT 'due'");
    await safeAddColumn("invoices", "grandTotal", "DECIMAL(15,2) DEFAULT 0");
    await safeAddColumn("invoices", "specifications", "LONGTEXT");
    await safeAddColumn("invoices", "perSqFtRate", "DECIMAL(10,2) DEFAULT 690");
    await safeAddColumn("invoices", "emailSentTo", "VARCHAR(191)");
    await safeAddColumn("invoices", "emailSentAt", "DATETIME");
    await safeAddColumn("invoices", "rawMaterials", "LONGTEXT");
    await safeAddColumn("invoices", "companyGstin", "VARCHAR(50)");
    await safeAddColumn("invoices", "clientAddress", "TEXT");
    await safeAddColumn("invoices", "clientCity", "VARCHAR(100)");
    await safeAddColumn("invoices", "clientState", "VARCHAR(100)");
    await safeAddColumn("invoices", "clientGst", "VARCHAR(50)");
    await safeAddColumn("invoices", "profileSeries", "VARCHAR(50) DEFAULT 'INVENTA'");
    await safeAddColumn("invoices", "glassType", "VARCHAR(100)");
    await safeAddColumn("invoices", "hardware", "VARCHAR(100)");
    await safeAddColumn("invoices", "discountPercentage", "DECIMAL(5,2) DEFAULT 0");
    await safeAddColumn("invoices", "projectName", "VARCHAR(191)");
    await safeAddColumn("invoices", "installationIncluded", "TINYINT(1) DEFAULT 1");
    await safeAddColumn("invoices", "quotationNumber", "VARCHAR(50)");

    await safeAddColumn("payrolls", "paymentReference", "VARCHAR(100)");
    await safeAddColumn("payrolls", "approvedAt", "DATETIME");
    await safeAddColumn("payrolls", "advanceDeduction", "DECIMAL(15,2) DEFAULT 0");

    await safeAddColumn("sales_orders", "productionNotes", "TEXT");
    await safeAddColumn("sales_orders", "productionStage", "VARCHAR(100)");
    await safeAddColumn("sales_orders", "supervisorName", "VARCHAR(191)");
    await safeAddColumn("sales_orders", "supervisorSign", "VARCHAR(191)");
    await safeAddColumn("sales_orders", "inspectionDate", "DATETIME");
    await safeAddColumn("sales_orders", "inspectionStatus", "VARCHAR(50) DEFAULT 'Pending'");
    await safeAddColumn("sales_orders", "fulfillmentMeasurement", "VARCHAR(50) DEFAULT 'tentative'");

    console.log("✅ All MySQL tables and schema upgrades verified successfully.");
  } finally {
    connection.release();
  }
}
