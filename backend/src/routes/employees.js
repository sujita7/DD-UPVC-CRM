import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { Employee } from "../models/index.js";

const router = Router();

function safeObject(val) {
  if (!val) return {};
  if (typeof val === "object") {
    return typeof val.toObject === "function" ? val.toObject() : val;
  }
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch (e) {
      return {};
    }
  }
  return {};
}

// GET /api/employees - List all employees
router.get("/api/employees", requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, department, search, employmentType } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;
    if (department) filter.department = { $regex: department, $options: "i" };
    if (employmentType) filter.employmentType = employmentType;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
      ];
    }

    const [employees, total] = await Promise.all([
      Employee.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select("-documents -salary.pf -salary.esi -salary.tds")
        .lean(),
      Employee.countDocuments(filter),
    ]);

    return res.json({
      ok: true,
      employees,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/employees/:id - Get single employee
router.get("/api/employees/:id", requireAuth, async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id).lean();
    if (!employee) return res.status(404).json({ error: "NOT_FOUND", message: "Employee not found." });
    return res.json({ ok: true, employee });
  } catch (error) {
    return next(error);
  }
});

// POST /api/employees - Create employee
router.post("/api/employees", requireAuth, async (req, res, next) => {
  try {
    const data = { ...req.body };

    const phone = data.phone ? data.phone.trim() : null;
    const aadharNumber = data.aadharNumber || data.documents?.aadharNumber;
    const trimmedAadhar = aadharNumber ? aadharNumber.trim() : null;

    if (!trimmedAadhar) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Aadhar number is mandatory.",
      });
    }

    // Check for duplicate employeeId
    if (data.employeeId && data.employeeId.trim()) {
      data.employeeId = data.employeeId.trim();
      const existingEmpId = await Employee.findOne({ employeeId: data.employeeId });
      if (existingEmpId) {
        return res.status(400).json({
          error: "DUPLICATE_EMPLOYEE_ID",
          message: `Employee ID ${data.employeeId} is already in use.`,
        });
      }
    } else {
      const count = await Employee.countDocuments();
      data.employeeId = `EMP${String(count + 1).padStart(4, "0")}`;
    }

    // Check for duplicate phone
    if (phone) {
      const existingPhone = await Employee.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({
          error: "DUPLICATE_PHONE",
          message: "An employee with this mobile number already exists.",
        });
      }
    }

    // Check for duplicate Aadhar number
    if (trimmedAadhar) {
      const existingAadhar = await Employee.findOne({
        "documents.aadharNumber": trimmedAadhar,
      });
      if (existingAadhar) {
        return res.status(400).json({
          error: "DUPLICATE_AADHAR",
          message: "An employee with this Aadhar number already exists.",
        });
      }
    }

    // Embed Aadhar into documents
    data.documents = {
      ...(data.documents || {}),
      aadharNumber: trimmedAadhar,
    };

    // If email is empty string, remove it so sparse unique index is not violated
    if (!data.email || !data.email.trim()) {
      delete data.email;
    }
    // If fullName is provided instead of firstName/lastName
    if (data.name && (!data.firstName || !data.lastName)) {
      const parts = data.name.trim().split(" ");
      data.firstName = parts[0];
      data.lastName = parts.slice(1).join(" ") || "-";
    }
    if (data.baseSalary !== undefined && (!data.salary || !data.salary.basic)) {
      data.salary = {
        ...(data.salary || {}),
        basic: Number(data.baseSalary) || 0,
        grossSalary: Number(data.baseSalary) || 0,
      };
    }
    if (data.joiningDate && !data.joinDate) {
      data.joinDate = new Date(data.joiningDate);
    }
    const employee = new Employee({ ...data, createdBy: req.admin._id });
    await employee.save();
    return res.status(201).json({ ok: true, employee });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        error: "DUPLICATE_KEY",
        message: "An employee with this record already exists (duplicate entry).",
      });
    }
    return next(error);
  }
});

// PUT /api/employees/:id - Update employee
router.put("/api/employees/:id", requireAuth, async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ error: "NOT_FOUND", message: "Employee not found." });

    const data = { ...req.body };
    const phone = data.phone ? data.phone.trim() : null;
    const aadharNumber = data.aadharNumber || data.documents?.aadharNumber;
    const trimmedAadhar = aadharNumber ? aadharNumber.trim() : null;

    // Check for duplicate employeeId on other employees
    if (data.employeeId && data.employeeId.trim()) {
      data.employeeId = data.employeeId.trim();
      const existingEmpId = await Employee.findOne({
        employeeId: data.employeeId,
        _id: { $ne: req.params.id },
      });
      if (existingEmpId) {
        return res.status(400).json({
          error: "DUPLICATE_EMPLOYEE_ID",
          message: `Employee ID ${data.employeeId} is already in use by another employee.`,
        });
      }
    }

    // Check for duplicate phone on other employees
    if (phone) {
      const existingPhone = await Employee.findOne({ phone, _id: { $ne: req.params.id } });
      if (existingPhone) {
        return res.status(400).json({
          error: "DUPLICATE_PHONE",
          message: "Another employee with this mobile number already exists.",
        });
      }
    }

    // Check for duplicate Aadhar on other employees
    if (trimmedAadhar) {
      const existingAadhar = await Employee.findOne({
        "documents.aadharNumber": trimmedAadhar,
        _id: { $ne: req.params.id },
      });
      if (existingAadhar) {
        return res.status(400).json({
          error: "DUPLICATE_AADHAR",
          message: "Another employee with this Aadhar number already exists.",
        });
      }
      data.documents = {
        ...safeObject(employee.documents),
        ...safeObject(data.documents),
        aadharNumber: trimmedAadhar,
      };
    }

    if (!data.email || !data.email.trim()) {
      delete data.email;
    }
    if (data.baseSalary !== undefined) {
      data.salary = {
        ...safeObject(employee.salary),
        ...safeObject(data.salary),
        basic: Number(data.baseSalary) || 0,
        grossSalary: Number(data.baseSalary) || 0,
        baseSalary: Number(data.baseSalary) || 0,
      };
    }
    if (data.joiningDate && !data.joinDate) {
      data.joinDate = new Date(data.joiningDate);
    }
    if (data.bankDetails) {
      data.bankDetails = {
        ...safeObject(employee.bankDetails),
        ...safeObject(data.bankDetails),
      };
    }

    Object.assign(employee, data);
    await employee.save();

    return res.json({ ok: true, employee });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        error: "DUPLICATE_KEY",
        message: "An employee with this record already exists (duplicate entry).",
      });
    }
    return next(error);
  }
});

// DELETE /api/employees/:id - Soft delete (set status to terminated)
router.delete("/api/employees/:id", requireAuth, async (req, res, next) => {
  try {
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "terminated", endDate: new Date() } },
      { new: true }
    ).lean();
    if (!employee) return res.status(404).json({ error: "NOT_FOUND", message: "Employee not found." });
    return res.json({ ok: true, message: "Employee terminated.", employee });
  } catch (error) {
    return next(error);
  }
});

// GET /api/employees/departments/list - Get unique departments
router.get("/api/employees/departments/list", requireAuth, async (req, res, next) => {
  try {
    const departments = await Employee.distinct("department");
    return res.json({ ok: true, departments: departments.filter(Boolean) });
  } catch (error) {
    return next(error);
  }
});

export default router;
