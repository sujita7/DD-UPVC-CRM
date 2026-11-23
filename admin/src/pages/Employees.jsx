import React, { useState, useEffect, useCallback } from "react";
import { App } from "antd";
import { employeeAPI } from "../services/api";

function pillColor(s) {
  const x = (s || "").toLowerCase();
  if (/active|present/.test(x)) return "green";
  if (/leave|inactive|on leave/.test(x)) return "amber";
  if (/terminated|absent/.test(x)) return "red";
  return "blue";
}

export default function Employees() {
  const { message } = App.useApp();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [form, setForm] = useState({
    employeeId: "",
    name: "",
    phone: "",
    email: "",
    aadharNumber: "",
    department: "Production",
    designation: "Employee",
    joiningDate: "",
    baseSalary: "",
    paidLeaves: "12",
    status: "active",
    // Optional Bank Details
    bankHolderName: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    accountType: "savings",
  });

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All statuses");

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await employeeAPI.list({ limit: 100 });
      const list = res.data?.employees || res.data?.data?.employees || [];
      const normalized = list.map((emp) => ({
        ...emp,
        name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.name,
        baseSalary: emp.salary?.basic || emp.salary?.grossSalary || emp.baseSalary || 0,
        aadharNumber: emp.documents?.aadharNumber || emp.aadharNumber || "",
      }));
      setEmployees(normalized);
    } catch (e) {
      console.error("Failed to load employees", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const openCreate = () => {
    setEditingEmp(null);
    setErrorMessage("");

    // Automatically suggest next Employee ID (e.g. EMP0005)
    let nextId = "EMP0001";
    if (employees.length > 0) {
      const nums = employees
        .map((e) => {
          const m = (e.employeeId || "").match(/(\d+)/);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter((n) => !isNaN(n) && n > 0);
      const maxNum = nums.length > 0 ? Math.max(...nums) : employees.length;
      nextId = `EMP${String(maxNum + 1).padStart(4, "0")}`;
    }

    setForm({
      employeeId: nextId,
      name: "",
      phone: "",
      email: "",
      aadharNumber: "",
      department: "Production",
      designation: "Employee",
      joiningDate: new Date().toISOString().slice(0, 10),
      baseSalary: "",
      paidLeaves: "12",
      status: "active",
      bankHolderName: "",
      bankName: "",
      accountNumber: "",
      ifscCode: "",
      accountType: "savings",
    });
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setEditingEmp(emp);
    setErrorMessage("");
    setForm({
      employeeId: emp.employeeId || "",
      name: emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
      phone: emp.phone || "",
      email: emp.email || "",
      aadharNumber: emp.documents?.aadharNumber || emp.aadharNumber || "",
      department: emp.department || "Production",
      designation: emp.designation || "Employee",
      joiningDate: (emp.joinDate || emp.joiningDate || "").slice(0, 10),
      baseSalary: (emp.baseSalary || emp.salary?.basic || emp.salary?.grossSalary || "").toString(),
      paidLeaves: (emp.paidLeaves || 12).toString(),
      status: emp.status || "active",
      bankHolderName: emp.bankDetails?.accountHolderName || "",
      bankName: emp.bankDetails?.bankName || "",
      accountNumber: emp.bankDetails?.accountNumber || "",
      ifscCode: emp.bankDetails?.ifscCode || "",
      accountType: emp.bankDetails?.accountType || "savings",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setErrorMessage("");

    // Client-side Mandatory Checks
    if (!form.employeeId.trim()) {
      setErrorMessage("Employee ID is required.");
      return;
    }
    if (!form.name.trim()) {
      setErrorMessage("Employee name is required.");
      return;
    }
    if (!form.phone.trim()) {
      setErrorMessage("Phone number is required.");
      return;
    }
    if (!form.aadharNumber.trim()) {
      setErrorMessage("Aadhar number is a mandatory field.");
      return;
    }
    if (!form.joiningDate) {
      setErrorMessage("Joining date is required.");
      return;
    }
    if (!form.baseSalary) {
      setErrorMessage("Monthly base salary is required.");
      return;
    }

    // Client-side Duplicate Check for instant UI feedback
    const trimmedEmpId = (form.employeeId || "").trim().toUpperCase();
    const trimmedPhone = form.phone.trim();
    const trimmedAadhar = form.aadharNumber.trim();

    if (trimmedEmpId) {
      const duplicateEmpId = employees.find(
        (e) =>
          (e.employeeId || "").toUpperCase() === trimmedEmpId &&
          (!editingEmp || (e._id !== editingEmp._id && e.id !== editingEmp.id))
      );
      if (duplicateEmpId) {
        setErrorMessage(`Employee ID '${trimmedEmpId}' is already assigned to another employee.`);
        return;
      }
    }

    const duplicatePhone = employees.find(
      (e) => e.phone === trimmedPhone && (!editingEmp || (e._id !== editingEmp._id && e.id !== editingEmp.id))
    );
    if (duplicatePhone) {
      setErrorMessage(`Employee already exists with mobile number: ${trimmedPhone}`);
      return;
    }

    const duplicateAadhar = employees.find(
      (e) =>
        (e.documents?.aadharNumber === trimmedAadhar || e.aadharNumber === trimmedAadhar) &&
        (!editingEmp || (e._id !== editingEmp._id && e.id !== editingEmp.id))
    );
    if (duplicateAadhar) {
      setErrorMessage(`Employee already exists with Aadhar number: ${trimmedAadhar}`);
      return;
    }

    try {
      const payload = {
        employeeId: trimmedEmpId || undefined,
        name: form.name.trim(),
        phone: trimmedPhone,
        email: form.email?.trim() || undefined,
        aadharNumber: trimmedAadhar,
        department: form.department,
        designation: form.designation,
        joiningDate: form.joiningDate,
        baseSalary: Number(form.baseSalary),
        paidLeaves: Number(form.paidLeaves) || 0,
        status: form.status,
        bankDetails: {
          accountHolderName: form.bankHolderName || undefined,
          bankName: form.bankName || undefined,
          accountNumber: form.accountNumber || undefined,
          ifscCode: form.ifscCode || undefined,
          accountType: form.accountType || "savings",
        },
      };

      if (editingEmp) {
        await employeeAPI.update(editingEmp._id || editingEmp.id, payload);
        message.success("Employee updated successfully.");
      } else {
        await employeeAPI.create(payload);
        message.success("Employee created successfully.");
      }
      setShowModal(false);
      fetchEmployees();
    } catch (e) {
      const serverMsg =
        e.response?.data?.message || e.response?.data?.error || "Failed to save employee.";
      setErrorMessage(serverMsg);
    }
  };

  const filteredEmployees = employees.filter((e) => {
    const matchesSearch =
      (e.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.department || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.employeeId || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.aadharNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.phone || "").includes(search);

    if (!matchesSearch) return false;
    if (filterStatus === "All statuses") return true;
    return (e.status || "").toLowerCase() === filterStatus.toLowerCase();
  });

  return (
    <>
      <div className="crumb">
        DD UPVC <span style={{ margin: "0 6px" }}>/</span> EMPLOYEES
      </div>
      <div className="pagehead">
        <div>
          <h1>Employees</h1>
          <p>Employee records, departments, documents, contracts and salary structures.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => message.info("Export prepared in connected application.")}>
            ⇩ Export
          </button>
          <button className="btn primary" onClick={openCreate}>
            ＋ Add employee
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid stats">
        <div className="card stat">
          <div className="statrow">
            <span>Total employees</span>
            <span className="staticon">♧</span>
          </div>
          <strong>{employees.length}</strong>
          <span className="trend">Active workforce</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Active</span>
            <span className="staticon">✓</span>
          </div>
          <strong>{employees.filter((e) => (e.status || "active") === "active").length}</strong>
          <span className="trend">Currently working</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>On leave</span>
            <span className="staticon">◷</span>
          </div>
          <strong>{employees.filter((e) => e.status === "on-leave" || e.status === "leave").length}</strong>
          <span className="trend">Approved leave</span>
        </div>
        <div className="card stat">
          <div className="statrow">
            <span>Monthly payroll</span>
            <span className="staticon">₹</span>
          </div>
          <strong>₹{employees.reduce((s, e) => s + (Number(e.baseSalary) || 0), 0).toLocaleString("en-IN")}</strong>
          <span className="trend">Total base salary</span>
        </div>
      </div>

      {/* Prototype Table Card */}
      <div className="card">
        <div className="cardhead">
          <h2>
            Employees <span className="muted" style={{ fontWeight: 400 }}>({filteredEmployees.length})</span>
          </h2>
          <button className="btn" onClick={() => message.info("Filter panel ready.")}>
            ☷ Filters
          </button>
        </div>
        <div className="toolbar" style={{ padding: "14px 16px 0", marginBottom: 0 }}>
          <input
            placeholder="Search by name, Aadhar, phone, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option>All statuses</option>
            <option value="active">Active</option>
            <option value="on-leave">On leave</option>
            <option value="inactive">Inactive</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Employee</th>
                <th>Phone</th>
                <th>Aadhar Number</th>
                <th>Department</th>
                <th>Monthly salary</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((r) => (
                  <tr key={r._id || r.employeeId}>
                    <td>
                      <b>{r.employeeId || "—"}</b>
                    </td>
                    <td>
                      <div className="customer">
                        <div className="miniavatar">
                          {(r.name || "U")
                            .split(" ")
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div>
                          <b>{r.name}</b>
                          <small>{r.designation || r.department || "General"}</small>
                        </div>
                      </div>
                    </td>
                    <td>{r.phone || "—"}</td>
                    <td>
                      <b>{r.aadharNumber || "—"}</b>
                    </td>
                    <td>{r.department || "General"}</td>
                    <td>₹{Number(r.baseSalary || 0).toLocaleString("en-IN")}</td>
                    <td>
                      <span className={`pill ${pillColor(r.status)}`}>
                        {r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : "Active"}
                      </span>
                    </td>
                    <td>
                      <button className="btn" style={{ padding: "6px 9px" }} onClick={() => openEdit(r)}>
                        Edit ↗
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8">
                    <div className="emptyhint">
                      <b>No matching records</b>
                      {loading ? "Loading employees..." : "Try another search term or click '+ Add employee'."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 16px", color: "#8390a2", fontSize: 11, borderTop: "1px solid var(--line)" }}>
          Showing {filteredEmployees.length} records · DD UPVC Employee Registry
        </div>
      </div>

      {/* Feature Section Grid */}
      <div className="grid sectiongrid" style={{ marginTop: 16 }}>
        {[
          ["Employee directory", "Profiles, roles and employment records", "♙"],
          ["Employee documents", "Aadhar, contracts, IDs and bank accounts", "▤"],
          ["Salary structures", "Earnings, allowances and deductions", "₹"],
        ].map(([t, d, ic], i) => (
          <div className="card feature" key={i}>
            <div className="featureicon">{ic}</div>
            <h3>{t}</h3>
            <p>{d}</p>
            <button className="btn" onClick={() => message.info(`${t} module active.`)}>
              Open module ↗
            </button>
          </div>
        ))}
      </div>

      {/* Add / Edit Employee Modal with Aadhar (Mandatory) & Bank Details (Optional) */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 650 }} onClick={(e) => e.stopPropagation()}>
            <div className="cardhead">
              <h2>{editingEmp ? "Edit employee" : "Add employee"}</h2>
              <button className="btn" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>
            <div className="cardbody">
              {/* Red Alert on duplicate or validation error */}
              {errorMessage && (
                <div
                  style={{
                    background: "#fee2e2",
                    border: "1px solid #ef4444",
                    color: "#b91c1c",
                    padding: "10px 14px",
                    borderRadius: 8,
                    marginBottom: 16,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  ⚠️ {errorMessage}
                </div>
              )}

              <div className="formgrid">
                <div className="field">
                  <label>Employee ID *</label>
                  <input
                    value={form.employeeId}
                    onChange={(e) => {
                      setForm({ ...form, employeeId: e.target.value.toUpperCase() });
                      setErrorMessage("");
                    }}
                    placeholder="e.g. EMP0001"
                  />
                </div>
                <div className="field">
                  <label>Employee name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => {
                      setForm({ ...form, name: e.target.value });
                      setErrorMessage("");
                    }}
                    placeholder="Full name"
                  />
                </div>
                <div className="field">
                  <label>Phone number *</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => {
                      setForm({ ...form, phone: e.target.value });
                      setErrorMessage("");
                    }}
                    placeholder="10-digit mobile number"
                  />
                </div>

                <div className="field">
                  <label>Aadhar number * (Mandatory)</label>
                  <input
                    type="text"
                    value={form.aadharNumber}
                    onChange={(e) => {
                      setForm({ ...form, aadharNumber: e.target.value });
                      setErrorMessage("");
                    }}
                    placeholder="12-digit Aadhar number"
                  />
                </div>

                <div className="field">
                  <label>Email address (optional)</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="name@company.com"
                  />
                </div>

                <div className="field">
                  <label>Department *</label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                  >
                    <option>Production</option>
                    <option>Sales</option>
                    <option>Accounts</option>
                    <option>HR</option>
                    <option>Installation</option>
                  </select>
                </div>

                <div className="field">
                  <label>Designation</label>
                  <input
                    value={form.designation}
                    onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    placeholder="e.g. Fabricator, Manager"
                  />
                </div>

                <div className="field">
                  <label>Joining date *</label>
                  <input
                    type="date"
                    value={form.joiningDate}
                    onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label>Monthly base salary (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    value={form.baseSalary}
                    onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
                    placeholder="e.g. 28000"
                  />
                </div>

                <div className="field">
                  <label>Paid leaves (yearly)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.paidLeaves}
                    onChange={(e) => setForm({ ...form, paidLeaves: e.target.value })}
                    placeholder="12"
                  />
                </div>

                <div className="field">
                  <label>Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="active">Active</option>
                    <option value="on-leave">On leave</option>
                    <option value="inactive">Inactive</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </div>

                {/* Optional Bank Details Section */}
                <div className="full" style={{ marginTop: 10 }}>
                  <h4 style={{ margin: "8px 0 12px", fontSize: 13, color: "var(--navy)" }}>
                    Bank Account Details (Optional)
                  </h4>
                </div>

                <div className="field">
                  <label>Bank Name (optional)</label>
                  <input
                    value={form.bankName}
                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                    placeholder="e.g. HDFC Bank, SBI"
                  />
                </div>

                <div className="field">
                  <label>Account Holder Name (optional)</label>
                  <input
                    value={form.bankHolderName}
                    onChange={(e) => setForm({ ...form, bankHolderName: e.target.value })}
                    placeholder="As per passbook"
                  />
                </div>

                <div className="field">
                  <label>Account Number (optional)</label>
                  <input
                    value={form.accountNumber}
                    onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                    placeholder="Bank account number"
                  />
                </div>

                <div className="field">
                  <label>IFSC Code (optional)</label>
                  <input
                    value={form.ifscCode}
                    onChange={(e) => setForm({ ...form, ifscCode: e.target.value })}
                    placeholder="e.g. HDFC0001234"
                  />
                </div>
              </div>

              <p className="muted" style={{ fontSize: 11, marginTop: 16 }}>
                Mandatory fields: Employee ID, Name, Phone, Aadhar number, Joining Date, Base Salary. Email and Bank details are optional.
              </p>
            </div>
            <div className="modalfoot">
              <button className="btn" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={handleSave}>
                {editingEmp ? "Update employee" : "Save employee"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
