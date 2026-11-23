import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Spin, Modal, Form, Input, Select, message, Popconfirm } from "antd";
import dayjs from "dayjs";
import { dashboardAPI, adminAPI } from "../services/api";

const adminControls = [
  {
    title: "User & Role Management",
    desc: "Invite employees & managers, configure system permissions",
    ico: "♙",
    action: "/employees",
  },
  {
    title: "Company Profile & Tax",
    desc: "Legal trade name, GSTIN, bank accounts, invoice prefix",
    ico: "⚙",
    action: "/settings",
  },
  {
    title: "Approval Workflows & Tasks",
    desc: "Follow up on customer quotes, workshop approvals & milestones",
    ico: "✓",
    action: "/tasks",
  },
  {
    title: "Financial Audits & Invoicing",
    desc: "Review tax invoices, collections, credit notes & ledger",
    ico: "◷",
    action: "/invoices",
  },
];

function rolePill(r) {
  const role = (r || "admin").toLowerCase();
  if (role === "superadmin") return <span className="pill green">Super Admin</span>;
  if (role === "admin") return <span className="pill blue">Admin</span>;
  if (role === "manager") return <span className="pill amber">Manager</span>;
  return <span className="pill blue">{role.toUpperCase()}</span>;
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [adminStats, setAdminStats] = useState({
    activeUsers: 1,
    activeAdmins: 1,
    activeEmployees: 0,
    pendingApprovals: 0,
    attendanceToday: { present: 0, total: 1, marked: 0 },
    payrollThisMonth: 0,
  });
  const [adminsList, setAdminsList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const res = await dashboardAPI.getStats();
      if (res.data?.ok && res.data?.admin) {
        setAdminStats(res.data.admin);
        if (Array.isArray(res.data.admin.adminsList)) {
          setAdminsList(res.data.admin.adminsList);
        }
      }
      // Also fetch admins directly if available
      try {
        const adminRes = await adminAPI.list({ limit: 50 });
        if (adminRes.data?.admins && Array.isArray(adminRes.data.admins)) {
          setAdminsList(adminRes.data.admins);
        }
      } catch (e) {
        // Fallback to dashboard adminsList
      }
    } catch (err) {
      console.error("Failed to load admin panel data:", err);
      message.error("Could not load latest admin analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleCreateAdmin = async (values) => {
    setSubmitting(true);
    try {
      await adminAPI.create({
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role || "admin",
        department: values.department || "Operations",
        designation: values.designation || "Administrator",
        phone: values.phone || "",
      });
      message.success(`User ${values.name} invited successfully!`);
      setIsModalOpen(false);
      form.resetFields();
      fetchAdminData();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to create administrator account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="crumb">
        DD UPVC <span style={{ margin: "0 6px" }}>/</span> ADMIN PANEL
      </div>
      <div className="pagehead">
        <div>
          <h1>Admin Panel</h1>
          <p>Owner-level control for users, business credentials, approval workflows and operations.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={fetchAdminData} style={{ marginRight: 8 }} title="Refresh metrics">
            ⟳ Refresh
          </button>
          <button className="btn primary" onClick={() => setIsModalOpen(true)}>
            ＋ Invite User / Admin
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
          <Spin size="large" />
          <p className="muted" style={{ marginTop: 12 }}>Loading admin &amp; system parameters…</p>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid stats">
            <div className="card stat">
              <div className="statrow">
                <span>Active Users</span>
                <span className="staticon">♙</span>
              </div>
              <strong>{adminStats.activeUsers || 1}</strong>
              <span className="trend">
                {adminStats.activeAdmins || 1} admins · {adminStats.activeEmployees || 0} employees
              </span>
            </div>

            <div className="card stat">
              <div className="statrow">
                <span>Pending Approvals</span>
                <span className="staticon">✓</span>
              </div>
              <strong>{adminStats.pendingApprovals || 0}</strong>
              <span className="trend" style={{ color: adminStats.pendingApprovals > 0 ? "var(--amber)" : "var(--green)" }}>
                Quotes, orders &amp; operational tasks
              </span>
            </div>

            <div className="card stat">
              <div className="statrow">
                <span>Attendance Today</span>
                <span className="staticon">◷</span>
              </div>
              <strong>
                {adminStats.attendanceToday?.present || 0} / {adminStats.attendanceToday?.total || 1}
              </strong>
              <span className="trend" style={{ color: "var(--blue)" }}>
                {adminStats.attendanceToday?.marked || 0} logs registered today
              </span>
            </div>

            <div className="card stat">
              <div className="statrow">
                <span>Payroll This Month</span>
                <span className="staticon">₹</span>
              </div>
              <strong>₹{Number(adminStats.payrollThisMonth || 0).toLocaleString("en-IN")}</strong>
              <span className="trend" style={{ color: "var(--green)" }}>
                Active monthly salary allocation
              </span>
            </div>
          </div>

          {/* Admin controls + Quick actions */}
          <div className="grid two">
            <div className="card">
              <div className="cardhead">
                <h2>Admin controls</h2>
                <span className="pill blue">Owner access</span>
              </div>
              <div className="cardbody">
                <div className="grid sectiongrid">
                  {adminControls.map((c, i) => (
                    <div className="card feature" key={i}>
                      <div className="featureicon">{c.ico}</div>
                      <h3>{c.title}</h3>
                      <p>{c.desc}</p>
                      <button className="btn" onClick={() => navigate(c.action)}>
                        Configure ↗
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="cardhead">
                <h2>Admin quick actions</h2>
              </div>
              <div className="cardbody" style={{ display: "grid", gap: 10 }}>
                <button className="btn" onClick={() => setIsModalOpen(true)}>
                  ＋ Invite / Register an Admin User
                </button>
                <button className="btn" onClick={() => navigate("/attendance")}>
                  ◷ Review Staff Attendance
                </button>
                <button className="btn" onClick={() => navigate("/payroll")}>
                  ₹ Review Monthly Payroll
                </button>
                <button className="btn" onClick={() => navigate("/settings")}>
                  ⚙ DD UPVC Company Settings &amp; GSTIN
                </button>
                <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  Role permissions, audit trails, database records and approval rules are backed by the live MySQL relational database.
                </p>
              </div>
            </div>
          </div>

          {/* System Users & Administrators Table */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="cardhead" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0 }}>System Administrators &amp; Authorized Users</h2>
                <small className="muted">Live accounts with administrative and operational access</small>
              </div>
              <button className="btn primary" onClick={() => setIsModalOpen(true)}>
                ＋ Add User
              </button>
            </div>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Department &amp; Title</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {adminsList.length > 0 ? (
                    adminsList.map((a, i) => {
                      const name = a.name || "Administrator";
                      const email = a.email || "—";
                      const initials = name.slice(0, 2).toUpperCase();
                      return (
                        <tr key={a.id || a._id || i}>
                          <td>
                            <div className="customer">
                              <div className="miniavatar">{initials}</div>
                              <div>
                                <b style={{ color: "#103567" }}>{name}</b>
                              </div>
                            </div>
                          </td>
                          <td>{email}</td>
                          <td>{rolePill(a.role)}</td>
                          <td>
                            <span>{a.designation || a.department || "Operations"}</span>
                          </td>
                          <td>
                            <span className={`pill ${a.status === "active" ? "green" : "red"}`}>
                              {(a.status || "active").toUpperCase()}
                            </span>
                          </td>
                          <td>{a.createdAt ? dayjs(a.createdAt).format("DD MMM YYYY") : "—"}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                        No system administrators found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Invite / Create User Modal */}
      <Modal
        title={<b>Invite / Register System Administrator</b>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreateAdmin} initialValues={{ role: "admin", department: "Operations" }}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true, message: "Please enter user's full name" }]}>
            <Input placeholder="e.g. Sujita Kumari" />
          </Form.Item>

          <Form.Item name="email" label="Email Address" rules={[{ required: true, type: "email", message: "Please enter a valid email address" }]}>
            <Input placeholder="e.g. admin@ddupm.com" />
          </Form.Item>

          <Form.Item name="password" label="Temporary Password" rules={[{ required: true, min: 6, message: "Password must be at least 6 characters" }]}>
            <Input.Password placeholder="Enter secure password" />
          </Form.Item>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item name="role" label="Role">
              <Select>
                <Select.Option value="admin">Admin</Select.Option>
                <Select.Option value="manager">Manager</Select.Option>
                <Select.Option value="superadmin">Super Admin</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="department" label="Department">
              <Select>
                <Select.Option value="Operations">Operations</Select.Option>
                <Select.Option value="Sales & Marketing">Sales &amp; Marketing</Select.Option>
                <Select.Option value="Finance & Accounts">Finance &amp; Accounts</Select.Option>
                <Select.Option value="Fabrication & Workshop">Fabrication &amp; Workshop</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item name="designation" label="Designation / Title">
              <Input placeholder="e.g. Operations Head" />
            </Form.Item>

            <Form.Item name="phone" label="Phone Number">
              <Input placeholder="e.g. +91 9876543210" />
            </Form.Item>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
            <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? "Inviting…" : "Confirm & Create User"}
            </button>
          </div>
        </Form>
      </Modal>
    </>
  );
}
