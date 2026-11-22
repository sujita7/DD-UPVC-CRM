import React, { useState, useEffect, useCallback } from "react";
import { App } from "antd";
import dayjs from "dayjs";
import { taskAPI } from "../services/api";

function statusPill(status) {
  const s = (status || "").toLowerCase();
  if (s === "completed") {
    return <span className="pill green">✓ Completed</span>;
  }
  if (s === "delayed") {
    return <span className="pill red">! Delayed (Overdue)</span>;
  }
  return <span className="pill amber">◷ Pending</span>;
}

function priorityPill(priority) {
  const p = (priority || "").toLowerCase();
  if (p === "high") {
    return <span className="pill red" style={{ fontSize: 10, padding: "3px 8px" }}>High</span>;
  }
  if (p === "medium") {
    return <span className="pill amber" style={{ fontSize: 10, padding: "3px 8px" }}>Medium</span>;
  }
  return <span className="pill blue" style={{ fontSize: 10, padding: "3px 8px" }}>Low</span>;
}

export default function Tasks() {
  const { message } = App.useApp();
  const [tasks, setTasks] = useState([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, delayed: 0, completed: 0 });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("All"); // All | pending | delayed | completed
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [search, setSearch] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState({
    title: "",
    dueDate: dayjs().format("YYYY-MM-DD"),
    dueTime: "18:00",
    priority: "medium",
    status: "pending",
    category: "General",
    assignedTo: "Admin",
    notes: "",
  });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await taskAPI.list({
        status: statusFilter !== "All" ? statusFilter : undefined,
        priority: priorityFilter !== "All" ? priorityFilter : undefined,
        search: search.trim() || undefined,
      });

      setTasks(res.data?.tasks || []);
      if (res.data?.counts) {
        setCounts(res.data.counts);
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
      message.error("Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, search]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleOpenCreateModal = () => {
    setEditingTask(null);
    setForm({
      title: "",
      dueDate: dayjs().format("YYYY-MM-DD"),
      dueTime: "18:00",
      priority: "medium",
      status: "pending",
      category: "General",
      assignedTo: "Admin",
      notes: "",
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (task) => {
    setEditingTask(task);
    setForm({
      title: task.title || "",
      dueDate: dayjs(task.dueDate).format("YYYY-MM-DD"),
      dueTime: task.dueTime || "18:00",
      priority: task.priority || "medium",
      status: task.status || "pending",
      category: task.category || "General",
      assignedTo: task.assignedTo || "Admin",
      notes: task.notes || "",
    });
    setShowModal(true);
  };

  const handleSaveTask = async (e) => {
    if (e) e.preventDefault();
    if (!form.title.trim()) {
      message.error("Please enter a task title.");
      return;
    }
    if (!form.dueDate) {
      message.error("Please pick a due date.");
      return;
    }

    setSaving(true);
    try {
      if (editingTask) {
        await taskAPI.update(editingTask._id, form);
        message.success("Task updated successfully.");
      } else {
        await taskAPI.create(form);
        message.success("Task created successfully.");
      }
      setShowModal(false);
      fetchTasks();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to save task.");
    } finally {
      setSaving(false);
    }
  };

  // Quick checkbox toggle between completed and pending
  const handleToggleCompleted = async (task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    try {
      await taskAPI.updateStatus(task._id, newStatus);
      message.success(
        newStatus === "completed"
          ? `Marked "${task.title}" as completed.`
          : `Reopened "${task.title}" to pending.`
      );
      fetchTasks();
    } catch (err) {
      message.error("Failed to update status.");
    }
  };

  const handleDeleteTask = async (task) => {
    if (!window.confirm(`Are you sure you want to delete task "${task.title}"?`)) {
      return;
    }
    try {
      await taskAPI.delete(task._id);
      message.success("Task deleted.");
      fetchTasks();
    } catch (err) {
      message.error("Failed to delete task.");
    }
  };

  // Helper to format due timing
  const formatDueTiming = (dueDate, dueTime, status) => {
    const d = dayjs(dueDate);
    const dateFormatted = d.format("DD MMM YYYY");
    const timeFormatted = dueTime ? dueTime : "18:00";

    if (status === "completed") {
      return (
        <div>
          <b style={{ color: "var(--ink)" }}>{dateFormatted}</b>
          <small className="muted" style={{ display: "block" }}>
            {timeFormatted} · Done
          </small>
        </div>
      );
    }

    if (status === "delayed") {
      return (
        <div>
          <b style={{ color: "var(--red)" }}>{dateFormatted}</b>
          <small style={{ color: "var(--red)", fontWeight: 700, display: "block" }}>
            {timeFormatted} · Time exceeded
          </small>
        </div>
      );
    }

    // Pending
    const isToday = d.isSame(dayjs(), "day");
    const isTomorrow = d.isSame(dayjs().add(1, "day"), "day");

    return (
      <div>
        <b>{dateFormatted}</b>
        <small className="muted" style={{ display: "block" }}>
          {timeFormatted} {isToday ? "(Today)" : isTomorrow ? "(Tomorrow)" : ""}
        </small>
      </div>
    );
  };

  return (
    <>
      <div className="crumb">
        DD UPVC <span style={{ margin: "0 6px" }}>/</span> TASKS &amp; APPROVALS
      </div>

      <div className="pagehead">
        <div>
          <h1>Tasks &amp; Approvals</h1>
          <p>
            To-do tasks, time &amp; date deadlines, notes, and status tracking (pending, completed, delayed).
          </p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => message.info("Tasks export prepared.")}>
            ⇩ Export
          </button>
          <button className="btn primary" onClick={handleOpenCreateModal}>
            ＋ Create task
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid stats">
        <div className="card stat">
          <div className="statrow">
            <span>Total tasks</span>
            <span className="staticon">☑</span>
          </div>
          <strong>{counts.total}</strong>
          <span className="trend">To-do register items</span>
        </div>

        <div className="card stat">
          <div className="statrow">
            <span>Pending</span>
            <span className="staticon">◷</span>
          </div>
          <strong style={{ color: "var(--ink)" }}>{counts.pending}</strong>
          <span className="trend" style={{ color: "var(--amber)" }}>
            In progress / awaiting action
          </span>
        </div>

        <div className="card stat">
          <div className="statrow">
            <span>Delayed (Overdue)</span>
            <span className="staticon" style={{ background: "#fde9eb", color: "var(--red)" }}>
              !
            </span>
          </div>
          <strong style={{ color: "var(--red)" }}>{counts.delayed}</strong>
          <span className="trend" style={{ color: "var(--red)" }}>
            Due date/time exceeded
          </span>
        </div>

        <div className="card stat">
          <div className="statrow">
            <span>Completed</span>
            <span className="staticon" style={{ background: "#e5f7ef", color: "var(--green)" }}>
              ✓
            </span>
          </div>
          <strong style={{ color: "var(--green)" }}>{counts.completed}</strong>
          <span className="trend" style={{ color: "var(--green)" }}>
            Finished tasks
          </span>
        </div>
      </div>

      {/* Main Task List Card */}
      <div className="card">
        <div className="cardhead">
          <div>
            <h2>
              To-Do Task Register <span className="muted" style={{ fontWeight: 400 }}>({tasks.length})</span>
            </h2>
            <small className="muted">
              Click checkbox to mark completed. Tasks automatically mark as delayed if due date/time has passed.
            </small>
          </div>
          <div className="actions">
            {["All", "pending", "delayed", "completed"].map((st) => (
              <button
                key={st}
                className={`btn ${statusFilter === st ? "primary" : ""}`}
                style={{ padding: "6px 12px", textTransform: "capitalize" }}
                onClick={() => setStatusFilter(st)}
              >
                {st === "delayed" ? "Delayed (Overdue)" : st}
              </button>
            ))}
          </div>
        </div>

        {/* Toolbar Filter */}
        <div className="toolbar" style={{ padding: "14px 16px 0", marginBottom: 0 }}>
          <input
            placeholder="Search task title, notes, assigned owner, ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="All">All Priorities</option>
            <option value="high">High priority</option>
            <option value="medium">Medium priority</option>
            <option value="low">Low priority</option>
          </select>

          <button className="btn primary" onClick={handleOpenCreateModal}>
            ＋ Add task
          </button>
        </div>

        {/* Table Wrap */}
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: "center" }}>Done</th>
                <th>Task ID</th>
                <th>Task Title &amp; Notes</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Due Date &amp; Time</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", padding: 36, color: "#718096" }}>
                    {loading ? "Loading tasks..." : "No matching tasks found. Click '＋ Create task' to add a to-do!"}
                  </td>
                </tr>
              ) : (
                tasks.map((task) => {
                  const isDone = task.status === "completed";
                  return (
                    <tr
                      key={task._id}
                      style={{
                        background: isDone ? "#f9fafb" : "transparent",
                        opacity: isDone ? 0.75 : 1,
                      }}
                    >
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => handleToggleCompleted(task)}
                          style={{
                            width: 17,
                            height: 17,
                            cursor: "pointer",
                            accentColor: "var(--blue)",
                          }}
                          title={isDone ? "Mark as pending" : "Mark as completed"}
                        />
                      </td>

                      <td>
                        <b>{task.taskId || "TSK-001"}</b>
                      </td>

                      <td style={{ maxWidth: 360 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            color: "var(--ink)",
                            fontSize: 13,
                            textDecoration: isDone ? "line-through" : "none",
                          }}
                        >
                          {task.title}
                        </div>
                        {task.notes && (
                          <div
                            className="muted"
                            style={{
                              fontSize: 11,
                              marginTop: 3,
                              whiteSpace: "normal",
                              wordBreak: "break-word",
                            }}
                          >
                            📝 {task.notes}
                          </div>
                        )}
                      </td>

                      <td>
                        <span className="pill blue" style={{ fontSize: 10 }}>
                          {task.category || "General"}
                        </span>
                      </td>

                      <td>{priorityPill(task.priority)}</td>

                      <td>{formatDueTiming(task.dueDate, task.dueTime, task.status)}</td>

                      <td>{task.assignedTo || "Admin"}</td>

                      <td>{statusPill(task.status)}</td>

                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          className="btn"
                          style={{ padding: "5px 9px", marginRight: 6 }}
                          onClick={() => handleOpenEditModal(task)}
                          title="Edit task"
                        >
                          ✎ Edit
                        </button>
                        <button
                          className="btn"
                          style={{ padding: "5px 9px", color: "var(--red)", borderColor: "#fde9eb" }}
                          onClick={() => handleDeleteTask(task)}
                          title="Delete task"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "12px 16px", color: "#8390a2", fontSize: 11, borderTop: "1px solid var(--line)" }}>
          Showing {tasks.length} tasks · Task deadlines automatically monitor overdue status.
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modalback open">
          <div className="modal" style={{ width: "min(580px, 100%)" }}>
            <div className="cardhead">
              <h2>{editingTask ? "Edit To-Do Task" : "Create New To-Do Task"}</h2>
              <button className="btn" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>

            <div className="cardbody">
              <div className="formgrid">
                <div className="field full">
                  <label>Task Title *</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Follow up on overdue invoice INV-1003, site measurement for Pune"
                    autoFocus
                  />
                </div>

                <div className="field">
                  <label>Due Date *</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label>Due Time *</label>
                  <input
                    type="time"
                    value={form.dueTime}
                    onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label>Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  >
                    <option value="low">Low priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="high">High priority</option>
                  </select>
                </div>

                <div className="field">
                  <label>Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="delayed">Delayed (Overdue)</option>
                  </select>
                </div>

                <div className="field">
                  <label>Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    <option value="General">General</option>
                    <option value="Sales">Sales &amp; Quotations</option>
                    <option value="Accounts">Accounts &amp; Invoices</option>
                    <option value="Production">Production &amp; Factory</option>
                    <option value="Installation">Installation &amp; Site</option>
                    <option value="Purchases">Purchases &amp; Suppliers</option>
                    <option value="HR">HR &amp; Payroll</option>
                  </select>
                </div>

                <div className="field">
                  <label>Assigned To</label>
                  <input
                    value={form.assignedTo}
                    onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                    placeholder="e.g. Raghav Gupta / Site Manager"
                  />
                </div>

                <div className="field full">
                  <label>Notes &amp; Details</label>
                  <textarea
                    rows="3"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Add details, site address, client contact, or instructions for this task…"
                  />
                </div>
              </div>
            </div>

            <div className="modalfoot">
              <button className="btn" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn primary" disabled={saving} onClick={handleSaveTask}>
                {saving ? "Saving..." : editingTask ? "Update task" : "Create task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

