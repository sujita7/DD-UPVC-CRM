import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { Customer } from "../models/index.js";

const router = Router();

// GET /api/customers
router.get("/api/customers", requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, type, search, category } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (category) filter.category = { $regex: category, $options: "i" };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { companyName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { customerId: { $regex: search, $options: "i" } },
        { gstNumber: { $regex: search, $options: "i" } },
      ];
    }

    const [customers, total] = await Promise.all([
      Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Customer.countDocuments(filter),
    ]);

    return res.json({
      ok: true,
      customers,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/customers/:id
router.get("/api/customers/:id", requireAuth, async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ error: "NOT_FOUND", message: "Customer not found." });
    return res.json({ ok: true, customer });
  } catch (error) {
    return next(error);
  }
});

// POST /api/customers
router.post("/api/customers", requireAuth, async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.admin._id };
    if (!data.name) {
      data.name = data.companyName || "Unnamed Customer";
    }
    if (!data.customerId) {
      const count = await Customer.countDocuments();
      data.customerId = `CUST-${String(count + 1).padStart(4, "0")}`;
    }
    const customer = new Customer(data);
    await customer.save();
    return res.status(201).json({ ok: true, customer });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/customers/:id
router.put("/api/customers/:id", requireAuth, async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).lean();
    if (!customer) return res.status(404).json({ error: "NOT_FOUND", message: "Customer not found." });
    return res.json({ ok: true, customer });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/customers/:id (soft delete)
router.delete("/api/customers/:id", requireAuth, async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "inactive" } },
      { new: true }
    ).lean();
    if (!customer) return res.status(404).json({ error: "NOT_FOUND", message: "Customer not found." });
    return res.json({ ok: true, message: "Customer deactivated.", customer });
  } catch (error) {
    return next(error);
  }
});

export default router;
