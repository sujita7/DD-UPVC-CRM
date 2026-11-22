import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { SalesOrder, Customer, Quotation } from "../models/index.js";

const router = Router();

// GET /api/sales-orders - List sales orders
router.get("/api/sales-orders", requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 100, status, customer, search } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status && status !== "All") {
      const norm = String(status).toLowerCase().replace(/[-_]/g, " ").trim();
      if (norm === "in production" || norm === "production") {
        filter.status = { $in: ["in-production", "in_production", "in production", "production", "In Production"] };
      } else {
        filter.status = status;
      }
    }
    if (customer) filter.customer = customer;

    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { projectName: { $regex: search, $options: "i" } },
      ];
    }

    const [orders, total] = await Promise.all([
      SalesOrder.find(filter)
        .sort({ orderDate: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("customer", "name companyName email phone customerId")
        .lean(),
      SalesOrder.countDocuments(filter),
    ]);

    return res.json({
      ok: true,
      orders,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/sales-orders/:id
router.get("/api/sales-orders/:id", requireAuth, async (req, res, next) => {
  try {
    const order = await SalesOrder.findById(req.params.id)
      .populate("customer", "name companyName email phone gstNumber billingAddress")
      .populate("createdBy", "name email")
      .lean();
    if (!order) return res.status(404).json({ error: "NOT_FOUND", message: "Sales order not found." });
    return res.json({ ok: true, order });
  } catch (error) {
    return next(error);
  }
});

// POST /api/sales-orders
router.post("/api/sales-orders", requireAuth, async (req, res, next) => {
  try {
    const { customer: customerId, ...rest } = req.body || {};

    if (!customerId) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Customer is required." });
    }

    const customer = await Customer.findById(customerId).lean();
    if (!customer) return res.status(404).json({ error: "NOT_FOUND", message: "Customer not found." });

    const count = await SalesOrder.countDocuments();
    const orderNumber = rest.orderNumber || `SO-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const order = new SalesOrder({
      orderNumber,
      customer: customerId,
      customerSnapshot: {
        name: customer.name,
        companyName: customer.companyName,
        email: customer.email,
        phone: customer.phone,
        gstNumber: customer.gstNumber,
        billingAddress: customer.billingAddress,
      },
      orderDate: rest.orderDate ? new Date(rest.orderDate) : new Date(),
      deliveryDate: rest.deliveryDate ? new Date(rest.deliveryDate) : new Date(Date.now() + 30 * 86400000),
      createdBy: req.admin._id,
      ...rest,
    });

    await order.save();
    return res.status(201).json({ ok: true, order });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/sales-orders/:id
router.put("/api/sales-orders/:id", requireAuth, async (req, res, next) => {
  try {
    const order = await SalesOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "NOT_FOUND", message: "Sales order not found." });

    Object.assign(order, req.body);
    await order.save();

    return res.json({ ok: true, order });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/sales-orders/:id
router.delete("/api/sales-orders/:id", requireAuth, async (req, res, next) => {
  try {
    const order = await SalesOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "NOT_FOUND", message: "Sales order not found." });

    await order.deleteOne();
    return res.json({ ok: true, message: "Sales order deleted." });
  } catch (error) {
    return next(error);
  }
});

export default router;

