import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { Product } from "../models/index.js";

const router = Router();

// GET /api/products - List products & uPVC profiles catalogue
router.get("/api/products", requireAuth, async (req, res, next) => {
  try {
    const { series, category, search, limit = 200 } = req.query;

    const filter = {};
    if (series && series !== "All") filter.series = series;
    if (category && category !== "All") filter.category = category;

    if (search) {
      filter.$or = [
        { productCode: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { series: { $regex: search, $options: "i" } },
        { dimensions: { $regex: search, $options: "i" } },
      ];
    }

    const products = await Product.find(filter)
      .sort({ series: 1, name: 1 })
      .limit(Number(limit))
      .lean();

    return res.json({
      ok: true,
      products,
      total: products.length,
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/products/:id
router.get("/api/products/:id", requireAuth, async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ error: "NOT_FOUND", message: "Product not found." });
    return res.json({ ok: true, product });
  } catch (error) {
    return next(error);
  }
});

// POST /api/products
router.post("/api/products", requireAuth, async (req, res, next) => {
  try {
    const product = new Product(req.body);
    await product.save();
    return res.status(201).json({ ok: true, product });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/products/:id
router.put("/api/products/:id", requireAuth, async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "NOT_FOUND", message: "Product not found." });

    Object.assign(product, req.body);
    await product.save();

    return res.json({ ok: true, product });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/products/:id
router.delete("/api/products/:id", requireAuth, async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "NOT_FOUND", message: "Product not found." });

    await product.deleteOne();
    return res.json({ ok: true, message: "Product deleted." });
  } catch (error) {
    return next(error);
  }
});

export default router;
