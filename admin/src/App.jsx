import { Routes, Route, Navigate } from "react-router-dom";
import { Spin } from "antd";
import { useAuth } from "./context/AuthContext";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AdminPanel from "./pages/AdminPanel";
import Employees from "./pages/Employees";
import Attendance from "./pages/Attendance";
import Payroll from "./pages/Payroll";
import AdvancePayment from "./pages/AdvancePayment";
import Customers from "./pages/Customers";
import Suppliers from "./pages/Suppliers";
import Payments from "./pages/Payments";
import Invoices from "./pages/Invoices";
import Quotations from "./pages/Quotations";
import SalesOrders from "./pages/SalesOrders";
import Proforma from "./pages/Proforma";
import Settings from "./pages/Settings";
import Tasks from "./pages/Tasks";
import Expenses from "./pages/Expenses";
import Production from "./pages/Production";
import GenericModule from "./pages/GenericModule";

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <Spin size="large">
          <div style={{ padding: "2rem", textAlign: "center", color: "#718096", fontWeight: 600 }}>
            Loading DD UPVC Window System…
          </div>
        </Spin>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="admin" element={<AdminPanel />} />
        <Route path="employees" element={<Employees />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="advance-payment" element={<AdvancePayment />} />
        <Route path="customers" element={<Customers />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="payments" element={<Payments />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="quotations" element={<Quotations />} />
        <Route path="sales" element={<SalesOrders />} />
        <Route path="proforma" element={<Proforma />} />
        <Route path="settings" element={<Settings />} />
        <Route path="production" element={<Production />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="users" element={<GenericModule module="Users & Permissions" desc="Configure role-based access and audit activity." />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
