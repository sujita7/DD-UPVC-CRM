import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { Task } from "../models/index.js";

const router = Router();

// Helper to determine if deadline has passed
function computeTaskStatus(task) {
  if (task.status === "completed") return "completed";

  try {
    const d = new Date(task.dueDate);
    let hours = 18;
    let mins = 0;
    if (task.dueTime) {
      const parts = task.dueTime.split(":");
      if (parts.length >= 2) {
        hours = parseInt(parts[0], 10) || 18;
        mins = parseInt(parts[1], 10) || 0;
      }
    }
    d.setHours(hours, mins, 0, 0);

    if (new Date() > d) {
      return "delayed";
    }
  } catch (e) {
    // ignore
  }

  return task.status || "pending";
}

// GET /api/tasks - List all tasks
router.get("/api/tasks", requireAuth, async (req, res, next) => {
  try {
    const { status, priority, category, search, page = 1, limit = 100 } = req.query;

    const query = {};
    if (priority && priority !== "All") query.priority = priority.toLowerCase();
    if (category && category !== "All") query.category = category;

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
        { taskId: { $regex: search, $options: "i" } },
        { assignedTo: { $regex: search, $options: "i" } },
      ];
    }

    const tasks = await Task.find(query).sort({ dueDate: 1, dueTime: 1 }).lean();

    // Dynamically update delayed status for overdue tasks
    const processedTasks = tasks.map((t) => {
      const dynamicStatus = computeTaskStatus(t);
      return {
        ...t,
        status: dynamicStatus,
      };
    });

    // Filter by status if requested
    let filtered = processedTasks;
    if (status && status !== "All") {
      filtered = processedTasks.filter((t) => t.status.toLowerCase() === status.toLowerCase());
    }

    const counts = {
      total: processedTasks.length,
      pending: processedTasks.filter((t) => t.status === "pending").length,
      delayed: processedTasks.filter((t) => t.status === "delayed").length,
      completed: processedTasks.filter((t) => t.status === "completed").length,
    };

    return res.json({
      ok: true,
      tasks: filtered,
      counts,
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/tasks - Create task
router.post("/api/tasks", requireAuth, async (req, res, next) => {
  try {
    const { title, dueDate, dueTime, priority, status, notes, category, assignedTo } = req.body || {};

    if (!title || !dueDate) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Task title and due date are required." });
    }

    const task = new Task({
      title: title.trim(),
      dueDate: new Date(dueDate),
      dueTime: dueTime ? dueTime.trim() : "18:00",
      priority: priority || "medium",
      status: status || "pending",
      notes: notes ? notes.trim() : "",
      category: category ? category.trim() : "General",
      assignedTo: assignedTo ? assignedTo.trim() : "Admin",
      createdBy: req.admin?._id,
    });

    if (task.status === "completed") {
      task.completedAt = new Date();
    }

    await task.save();
    return res.status(201).json({ ok: true, task });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/tasks/:id - Update task
router.put("/api/tasks/:id", requireAuth, async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Task not found." });
    }

    const { title, dueDate, dueTime, priority, status, notes, category, assignedTo } = req.body || {};

    if (title !== undefined) task.title = title.trim();
    if (dueDate !== undefined) task.dueDate = new Date(dueDate);
    if (dueTime !== undefined) task.dueTime = dueTime.trim();
    if (priority !== undefined) task.priority = priority;
    if (notes !== undefined) task.notes = notes.trim();
    if (category !== undefined) task.category = category.trim();
    if (assignedTo !== undefined) task.assignedTo = assignedTo.trim();

    if (status !== undefined) {
      task.status = status;
      if (status === "completed") {
        task.completedAt = task.completedAt || new Date();
      } else {
        task.completedAt = null;
      }
    }

    await task.save();
    return res.json({ ok: true, task });
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/tasks/:id/status - Quick status toggle
router.patch("/api/tasks/:id/status", requireAuth, async (req, res, next) => {
  try {
    const { status } = req.body || {};
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Task not found." });
    }

    task.status = status;
    if (status === "completed") {
      task.completedAt = new Date();
    } else {
      task.completedAt = null;
    }

    await task.save();
    return res.json({ ok: true, task });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/tasks/:id - Delete task
router.delete("/api/tasks/:id", requireAuth, async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Task not found." });
    }

    await task.deleteOne();
    return res.json({ ok: true, message: "Task deleted successfully." });
  } catch (error) {
    return next(error);
  }
});

export default router;

