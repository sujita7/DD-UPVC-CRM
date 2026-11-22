import React, { useState, useEffect } from "react";
import { App } from "antd";
import { adminAPI } from "../services/api";

function statusPill(s) {
  const x = (s || "").toLowerCase();
  let c = /active|superadmin/.test(x) ? "green" : /inactive/.test(x) ? "red" : "blue";
  return <span className={`pill ${c}`}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : "Active"}</span>;
}

export default function Admins() {
  const { message } = App.useApp();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "manager",
    department: "Sales",
    status: "active",
  });

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.list();
      setAdmins(res.data?.admins || res.data?.data?.admins || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleOpenModal = () => {
    setForm({
      name: "",
      email: "",
      password: "",
      role: "manager",
      department: "Sales",
      status: "active",
    });
    setIsModalOpen(true);
  };

  const handleSaveAdmin = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      message.error("Name, email, and password are required.");
      return;
    }
    try {
      await adminAPI.create(form);
      message.success("User invited successfully.");
      setIsModalOpen(false);
      fetchAdmins();
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to create user.");
    }
  };

  const filteredAdmins = admins.filter((u) => {
    const matches =
      (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.role || "").toLowerCase().includes(search.toLowerCase());
    return matches;
  });

  return (
    <>
      <div className="crumb">
        DD UPVC <span style={{ margin: "0 6px" }}>/</span> USERS &amp; PERMISSIONS
      </div>
      <div className="pagehead">
        <div>
          <h1>Users &amp; Permissions</h1>
          <p>Configure role-based access control, departmental assignments and audit permissions.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => message.info("Export prepared in connected application.")}>
            ⇩ Export
          </button>
          <button className="btn primary" onClick={handleOpenModal}>
            ＋ Invite user
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid stats">
        <div className="card stat">
          <div className="statrow">
            <span>System users</span>
            <span className="staticon">♙</span>
          </div>
          <strong>{admins.length}</strong>
          <span className="trend">Staff portal accounts</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Super admins</span>
            <span className="staticon">✓</span>
          </div>
          <strong>{admins.filter((a) => a.role === "superadmin").length || 1}</strong>
          <span className="trend">Full root permissions</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Department managers</span>
            <span className="staticon">⚙</span>
          </div>
          <strong>{admins.filter((a) => a.role === "manager").length || 0}</strong>
          <span className="trend">Operational supervisors</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Security audit</span>
            <span className="staticon">▣</span>
          </div>
          <strong>Active</strong>
          <span className="trend" style={{ color: "var(--green)" }}>Protected by JWT</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card">
        <div className="cardhead">
          <h2>
            Users &amp; Permissions <span className="muted" style={{ fontWeight: 400 }}>({filteredAdmins.length})</span>
          </h2>
          <button className="btn" onClick={() => message.info("Filter panel ready.")}>
            ☷ Filters
          </button>
        </div>

        <div className="toolbar" style={{ padding: "14px 16px 0", marginBottom: 0 }}>
          <input
            placeholder="Search users by name, email, role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name / Email</th>
                <th>Department</th>
                <th>Access Role</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdmins.length > 0 ? (
                filteredAdmins.map((r, i) => (
                  <tr key={r._id || i}>
                    <td>
                      <b>{`USR-${100 + i}`}</b>
                    </td>
                    <td>
                      <div className="customer">
                        <div className="miniavatar">
                          {(r.name || "U").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <b>{r.name}</b>
                          <small>{r.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>{r.department || "General"}</td>
                    <td>
                      <span className="pill blue">{(r.role || "staff").toUpperCase()}</span>
                    </td>
                    <td>{statusPill(r.status || "active")}</td>
                    <td>
                      <button
                        className="btn"
                        style={{ padding: "6px 10px" }}
                        onClick={() => message.info(`Permissions for ${r.name}`)}
                      >
                        Edit ↗
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6">
                    <div className="emptyhint">
                      <b>No users found</b>
                      {loading ? "Loading users..." : "Click '+ Invite user' to add team members."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 16px", color: "#8390a2", fontSize: 11, borderTop: "1px solid var(--line)" }}>
          Showing {filteredAdmins.length} users · DD UPVC Security Directory
        </div>
      </div>

      {/* Feature section grid */}
      <div className="grid sectiongrid" style={{ marginTop: 16 }}>
        {[
          ["Role Groups", "Owner, sales, accounts, factory manager and installation supervisor.", "♙"],
          ["Module Access", "Granular read, create, edit, approve and export permissions.", "◈"],
          ["Security & Audit Log", "Sign-in history, record revisions and financial modification logs.", "▣"],
        ].map((a, i) => (
          <div className="card feature" key={i}>
            <div className="featureicon">{a[2]}</div>
            <h3>{a[0]}</h3>
            <p>{a[1]}</p>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="cardhead">
              <h2>Invite Workspace User</h2>
              <button className="btn" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="cardbody">
              <div className="formgrid">
                <div className="field">
                  <label>Full Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="field">
                  <label>Work Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="user@ddupvc.com"
                  />
                </div>
                <div className="field">
                  <label>Initial Password *</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Min 6 characters"
                  />
                </div>
                <div className="field">
                  <label>Access Role *</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="staff">Staff</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </div>
                <div className="field">
                  <label>Department</label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                  >
                    <option>Sales</option>
                    <option>Production</option>
                    <option>Accounts</option>
                    <option>Installation</option>
                    <option>HR</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modalfoot">
              <button className="btn" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={handleSaveAdmin}>
                Save User
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
