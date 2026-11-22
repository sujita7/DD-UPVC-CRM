import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { Supplier } from "../models/index.js";

const router = Router();

// GET /api/suppliers
router.get("/api/suppliers", requireAuth, async (req, res, next) => {
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
        { supplierId: { $regex: search, $options: "i" } },
        { gstNumber: { $regex: search, $options: "i" } },
      ];
    }

    const [suppliers, total] = await Promise.all([
      Supplier.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Supplier.countDocuments(filter),
    ]);

    return res.json({
      ok: true,
      suppliers,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/suppliers/:id
router.get("/api/suppliers/:id", requireAuth, async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id).lean();
    if (!supplier) return res.status(404).json({ error: "NOT_FOUND", message: "Supplier not found." });
    return res.json({ ok: true, supplier });
  } catch (error) {
    return next(error);
  }
});

// POST /api/suppliers
router.post("/api/suppliers", requireAuth, async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.admin._id };
    if (!data.name) {
      data.name = data.companyName || "Unnamed Supplier";
    }
    if (!data.supplierId) {
      const count = await Supplier.countDocuments();
      data.supplierId = `SUPP-${String(count + 1).padStart(4, "0")}`;
    }
    const supplier = new Supplier(data);
    await supplier.save();
    return res.status(201).json({ ok: true, supplier });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/suppliers/:id
router.put("/api/suppliers/:id", requireAuth, async (req, res, next) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).lean();
    if (!supplier) return res.status(404).json({ error: "NOT_FOUND", message: "Supplier not found." });
    return res.json({ ok: true, supplier });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/suppliers/:id
router.delete("/api/suppliers/:id", requireAuth, async (req, res, next) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "inactive" } },
      { new: true }
    ).lean();
    if (!supplier) return res.status(404).json({ error: "NOT_FOUND", message: "Supplier not found." });
    return res.json({ ok: true, message: "Supplier deactivated.", supplier });
  } catch (error) {
    return next(error);
  }
});

export default router;
