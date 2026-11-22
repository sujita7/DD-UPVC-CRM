/**
 * CRM Database Seed Script for MySQL
 * Usage: npm run seed
 */
import { connectDB, disconnectDB } from "../config/db.js";
import { Admin, Employee, Customer, Supplier, Holiday, Task } from "../models/index.js";

async function seed() {
  try {
    console.log("🌱 Starting CRM MySQL Database Seed...\n");
    await connectDB();

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Create Superadmin
    // ──────────────────────────────────────────────────────────────────────────
    const existingSuperAdmin = await Admin.findOne({ role: "superadmin" });
    if (!existingSuperAdmin) {
      const superAdmin = new Admin({
        name: "Super Admin",
        email: "admin@crm.com",
        password: "Admin@123",
        role: "superadmin",
        permissions: ["*"],
        status: "active",
        department: "Management",
        designation: "System Administrator",
      });
      await superAdmin.save();
      console.log("✅ Superadmin created in MySQL:");
      console.log("   📧 Email: admin@crm.com");
      console.log("   🔑 Password: Admin@123\n");
    } else {
      console.log("ℹ️  Superadmin already exists. Skipping.\n");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Create Sample Employees
    // ──────────────────────────────────────────────────────────────────────────
    const empCount = await Employee.countDocuments();
    if (empCount === 0) {
      const employees = [
        {
          employeeId: "EMP0001",
          firstName: "Rahul",
          lastName: "Sharma",
          email: "rahul.sharma@company.com",
          phone: "9876543210",
          department: "Engineering",
          designation: "Software Engineer",
          paidLeaves: 2,
          employmentType: "full-time",
          joinDate: new Date("2023-01-15"),
          salary: { basic: 50000, hra: 20000, da: 5000, ta: 3000, pf: 6000, esi: 1800, netSalary: 70200 },
          status: "active",
          bankDetails: { bankName: "HDFC Bank", accountNumber: "12345678901", ifscCode: "HDFC0001234" },
          documents: { panNumber: "ABCDE1234F", aadharNumber: "1234-5678-9012" },
          address: { city: "Mumbai", state: "Maharashtra", country: "India", pincode: "400001" },
        },
        {
          employeeId: "EMP0002",
          firstName: "Priya",
          lastName: "Patel",
          email: "priya.patel@company.com",
          phone: "9876543211",
          department: "Sales",
          designation: "Sales Manager",
          paidLeaves: 2,
          employmentType: "full-time",
          joinDate: new Date("2022-06-01"),
          salary: { basic: 60000, hra: 24000, da: 6000, ta: 4000, pf: 7200, esi: 0, netSalary: 86800 },
          status: "active",
          bankDetails: { bankName: "SBI", accountNumber: "98765432101", ifscCode: "SBIN0001234" },
          address: { city: "Delhi", state: "Delhi", country: "India", pincode: "110001" },
        },
        {
          employeeId: "EMP0003",
          firstName: "Amit",
          lastName: "Kumar",
          email: "amit.kumar@company.com",
          phone: "9876543212",
          department: "Accounts",
          designation: "Accountant",
          paidLeaves: 1,
          employmentType: "full-time",
          joinDate: new Date("2023-03-20"),
          salary: { basic: 40000, hra: 16000, da: 4000, ta: 2500, pf: 4800, esi: 1440, netSalary: 56260 },
          status: "active",
          bankDetails: { bankName: "ICICI Bank", accountNumber: "11223344556", ifscCode: "ICIC0001234" },
          address: { city: "Pune", state: "Maharashtra", country: "India", pincode: "411001" },
        },
        {
          employeeId: "EM101",
          firstName: "Sujita",
          lastName: "Kumari",
          email: "sujita.kri07@gmail.com",
          phone: "9876543213",
          department: "General",
          designation: "Executive",
          paidLeaves: 2,
          employmentType: "full-time",
          joinDate: new Date("2026-09-01"),
          salary: { basic: 5000, hra: 2000, da: 500, ta: 500, pf: 0, esi: 0, netSalary: 8000 },
          status: "active",
          bankDetails: { bankName: "Punjab National Bank", accountNumber: "55443322110", ifscCode: "PUNB0001234" },
          address: { city: "Ranchi", state: "Jharkhand", country: "India", pincode: "834001" },
        },
      ];

      for (const emp of employees) {
        const e = new Employee(emp);
        await e.save();
      }
      console.log(`✅ Created ${employees.length} sample employees in MySQL\n`);
    } else {
      console.log("ℹ️  Employees already exist. Skipping.\n");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Create Sample Customers
    // ──────────────────────────────────────────────────────────────────────────
    const custCount = await Customer.countDocuments();
    if (custCount === 0) {
      const customers = [
        {
          customerId: "CUST-0001",
          type: "company",
          name: "Tech Solutions Pvt Ltd",
          companyName: "Tech Solutions Pvt Ltd",
          email: "contact@techsolutions.com",
          phone: "9812345678",
          gstNumber: "27AABCT1332L1ZU",
          billingAddress: { street: "123 Tech Park", city: "Bangalore", state: "Karnataka", pincode: "560001" },
          creditLimit: 500000,
          creditPeriod: 30,
          status: "active",
        },
        {
          customerId: "CUST-0002",
          type: "company",
          name: "Innovate Corp",
          companyName: "Innovate Corp",
          email: "info@innovatecorp.com",
          phone: "9823456789",
          gstNumber: "06AADCI1234P1ZX",
          billingAddress: { street: "456 Business Hub", city: "Gurgaon", state: "Haryana", pincode: "122001" },
          creditLimit: 300000,
          creditPeriod: 45,
          status: "active",
        },
        {
          customerId: "CUST-0003",
          type: "individual",
          name: "Vikram Mehta",
          email: "vikram.mehta@gmail.com",
          phone: "9834567890",
          billingAddress: { city: "Chennai", state: "Tamil Nadu", pincode: "600001" },
          status: "active",
        },
      ];

      for (const cust of customers) {
        const c = new Customer(cust);
        await c.save();
      }
      console.log(`✅ Created ${customers.length} sample customers in MySQL\n`);
    } else {
      console.log("ℹ️  Customers already exist. Skipping.\n");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Create Sample Suppliers
    // ──────────────────────────────────────────────────────────────────────────
    const suppCount = await Supplier.countDocuments();
    if (suppCount === 0) {
      const suppliers = [
        {
          supplierId: "SUPP-0001",
          type: "company",
          name: "Raw Materials Co",
          companyName: "Raw Materials Co Pvt Ltd",
          email: "supply@rawmaterials.com",
          phone: "9845678901",
          gstNumber: "29AABCR1234L1ZM",
          address: { street: "789 Industrial Area", city: "Mumbai", state: "Maharashtra", pincode: "400001" },
          paymentTerms: "net-30",
          bankDetails: {
            bankName: "Axis Bank",
            accountNumber: "11223344001",
            ifscCode: "UTIB0001234",
            accountType: "current",
          },
          status: "active",
        },
      ];

      for (const supp of suppliers) {
        const s = new Supplier(supp);
        await s.save();
      }
      console.log(`✅ Created ${suppliers.length} sample suppliers in MySQL\n`);
    } else {
      console.log("ℹ️  Suppliers already exist. Skipping.\n");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Create Initial Tasks
    // ──────────────────────────────────────────────────────────────────────────
    const taskCount = await Task.countDocuments();
    if (taskCount === 0) {
      const sampleTasks = [
        {
          taskId: "TSK-001",
          title: "Follow up with Tech Solutions for quotation approval",
          dueDate: new Date(Date.now() + 86400000),
          dueTime: "16:00",
          priority: "high",
          status: "pending",
          category: "Sales",
          assignedTo: "Admin",
          notes: "Verify item pricing discount before calling the client representative.",
        },
        {
          taskId: "TSK-002",
          title: "Verify monthly employee attendance & overtime register",
          dueDate: new Date(Date.now() - 3600000),
          dueTime: "11:00",
          priority: "medium",
          status: "pending",
          category: "HR",
          assignedTo: "HR Manager",
          notes: "Ensure all manual adjustments are finalized before running payroll calculation.",
        },
        {
          taskId: "TSK-003",
          title: "Dispatch glass fittings and aluminum profiles to Site B",
          dueDate: new Date(Date.now() + 172800000),
          dueTime: "14:30",
          priority: "low",
          status: "completed",
          category: "Operations",
          assignedTo: "Dispatch Team",
          notes: "Delivery challan DC-2026-088 verified with customer sign-off.",
        },
      ];

      for (const t of sampleTasks) {
        const task = new Task(t);
        await task.save();
      }
      console.log(`✅ Created ${sampleTasks.length} initial To-Do tasks in MySQL\n`);
    } else {
      console.log("ℹ️  Tasks already exist. Skipping.\n");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Create Initial Holidays
    // ──────────────────────────────────────────────────────────────────────────
    const holidayCount = await Holiday.countDocuments();
    if (holidayCount === 0) {
      const currentYear = new Date().getFullYear();
      const sampleHolidays = [
        { name: "Republic Day", date: new Date(`${currentYear}-01-26`), description: "National Holiday" },
        { name: "Independence Day", date: new Date(`${currentYear}-08-15`), description: "National Holiday" },
        { name: "Gandhi Jayanti", date: new Date(`${currentYear}-10-02`), description: "National Holiday" },
        { name: "Diwali", date: new Date(`${currentYear}-11-01`), description: "Festival of Lights" },
      ];

      for (const h of sampleHolidays) {
        const holiday = new Holiday(h);
        await holiday.save();
      }
      console.log(`✅ Created ${sampleHolidays.length} calendar holidays in MySQL\n`);
    }

    console.log("═════════════════════════════════════════════════════════");
    console.log("🎉 MySQL DATABASE SEEDED SUCCESSFULLY!");
    console.log("🔐 ADMIN LOGIN CREDENTIALS:");
    console.log("   URL:      http://localhost:3000");
    console.log("   Email:    admin@crm.com");
    console.log("   Password: Admin@123");
    console.log("═════════════════════════════════════════════════════════\n");

  } catch (error) {
    console.error("❌ Seed failed:", error);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

seed();
