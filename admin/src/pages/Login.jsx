import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { BusyIndicator } from "@ui5/webcomponents-react/BusyIndicator";
import { Input as Ui5Input } from "@ui5/webcomponents-react/Input";
import { Button as Ui5Button } from "@ui5/webcomponents-react/Button";
import { CheckBox as Ui5CheckBox } from "@ui5/webcomponents-react/CheckBox";
import { MessageStrip as Ui5MessageStrip } from "@ui5/webcomponents-react/MessageStrip";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("admin@crm.com");
  const [password, setPassword] = useState("Admin@123");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      await login(email, password, remember);
      navigate("/dashboard");
    } catch (err) {
      console.error("Login failed:", err);
      const msg =
        err.response?.data?.message ||
        "Invalid email or password. Please verify your credentials.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = () => {
    setEmail("admin@crm.com");
    setPassword("Admin@123");
  };

  return (
    <main
      style={{
        height: "100vh",
        display: "grid",
        placeItems: "center",
        backgroundColor: "#f5f6f7",
        padding: "1.5rem",
        fontFamily: "'72', '72full', 'Inter', sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          position: "relative",
          width: "min(32rem, calc(100vw - 2rem))",
          minHeight: "36rem",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#ffffff",
          border: "1px solid #e4e9ef",
          borderRadius: "0.75rem",
          boxShadow: "0 1.25rem 3rem rgba(26, 39, 52, 0.08)",
          overflow: "hidden",
        }}
      >
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 10,
              display: "grid",
              placeItems: "center",
              backgroundColor: "rgba(255, 255, 255, 0.8)",
            }}
          >
            <BusyIndicator active size="M" text="Authenticating with Payments OS..." />
          </div>
        )}

        <div style={{ padding: "2.5rem 2.25rem 1.5rem", flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Logo & Header */}
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span
                style={{
                  backgroundColor: "#0a6ed1",
                  color: "#fff",
                  fontWeight: 900,
                  fontSize: "0.85rem",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "4px",
                }}
              >
                CRM
              </span>
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1d2d3e" }}>
                Payments OS
              </span>
            </div>
            <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem", fontWeight: 700, color: "#1d2d3e" }}>
              Sign In
            </h1>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#5b738b" }}>
              Enterprise Workforce & Financial Administration
            </p>
          </div>

          {errorMsg && (
            <div style={{ marginBottom: "1.25rem" }}>
              <Ui5MessageStrip design="Negative" onClose={() => setErrorMsg("")}>
                {errorMsg}
              </Ui5MessageStrip>
            </div>
          )}

          {/* Form Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#1d2d3e", marginBottom: "0.35rem" }}>
                Email or Username
              </span>
              <Ui5Input
                value={email}
                onInput={(e) => setEmail(e.target.value)}
                placeholder="admin@crm.com"
                style={{ width: "100%" }}
                required
              />
            </div>

            <div>
              <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#1d2d3e", marginBottom: "0.35rem" }}>
                Password
              </span>
              <Ui5Input
                type="Password"
                value={password}
                onInput={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                style={{ width: "100%" }}
                required
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Ui5CheckBox
                text="Remember me on this workstation"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
            </div>

            <div style={{ marginTop: "1rem" }}>
              <Ui5Button
                design="Emphasized"
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  width: "100%",
                  height: "2.5rem",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                }}
              >
                Sign In
              </Ui5Button>
            </div>

            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.75rem",
                background: "#f0f6fc",
                border: "1px dashed #c5dcf7",
                borderRadius: "4px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "#5b738b" }}>
                Default Superadmin Credentials:
              </div>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0a6ed1", marginTop: "2px" }}>
                admin@crm.com / Admin@123
              </div>
              <button
                type="button"
                onClick={handleDemoFill}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#0a6ed1",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textDecoration: "underline",
                  cursor: "pointer",
                  marginTop: "4px",
                }}
              >
                Autofill Credentials
              </button>
            </div>
          </div>
        </div>
      </form>
    </main>
  );
}
