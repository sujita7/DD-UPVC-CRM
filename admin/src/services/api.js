import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Request Interceptor ──────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("crm_access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor (auto token refresh) ────────────────────────────────
let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(token) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh") &&
      !originalRequest.url?.includes("/auth/login")
    ) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const { data } = await api.post("/auth/refresh");
          const newToken = data.accessToken;
          localStorage.setItem("crm_access_token", newToken);
          isRefreshing = false;
          onRefreshed(newToken);
        } catch (refreshError) {
          isRefreshing = false;
          refreshSubscribers = [];
          localStorage.removeItem("crm_access_token");
          window.location.href = "/login";
          return Promise.reject(refreshError);
        }
      }

      return new Promise((resolve) => {
        refreshSubscribers.push((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    return Promise.reject(error);
  }
);

export default api;

// ── API Methods ──────────────────────────────────────────────────────────────

// Auth
export const authAPI = {
  login: (data) => api.post("/auth/login", data),
  logout: () => api.post("/auth/logout"),
  logoutAll: () => api.post("/auth/logout-all"),
  refresh: () => api.post("/auth/refresh"),
  session: () => api.get("/auth/session"),
  me: () => api.get("/me"),
  updateProfile: (data) => api.put("/me", data),
  changePassword: (data) => api.post("/auth/change-password", data),
};

// Dashboard
export const dashboardAPI = {
  getStats: () => api.get("/dashboard"),
};

// Employees
export const employeeAPI = {
  list: (params) => api.get("/employees", { params }),
  get: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post("/employees", data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  delete: (id) => api.delete(`/employees/${id}`),
  getDepartments: () => api.get("/employees/departments/list"),
};

// Attendance
export const attendanceAPI = {
  list: (params) => api.get("/attendance", { params }),
  get: (id) => api.get(`/attendance/${id}`),
  summary: (employeeId, params) => api.get(`/attendance/summary/${employeeId}`, { params }),
  create: (data) => api.post("/attendance", data),
  update: (id, data) => api.put(`/attendance/${id}`, data),
  delete: (id) => api.delete(`/attendance/${id}`),
  bulkMark: (data) => api.post("/attendance/bulk", data),
};

// Payroll
export const payrollAPI = {
  list: (params) => api.get("/payroll", { params }),
  get: (id) => api.get(`/payroll/${id}`),
  create: (data) => api.post("/payroll", data),
  update: (id, data) => api.put(`/payroll/${id}`, data),
  delete: (id) => api.delete(`/payroll/${id}`),
  approve: (id) => api.post(`/payroll/${id}/approve`),
  markPaid: (id, data) => api.post(`/payroll/${id}/mark-paid`, data),
  generateBulk: (data) => api.post("/payroll/generate-bulk", data),
};

// Holidays
export const holidayAPI = {
  list: (params) => api.get("/holidays", { params }),
  create: (data) => api.post("/holidays", data),
  delete: (id) => api.delete(`/holidays/${id}`),
};

// Customers
export const customerAPI = {
  list: (params) => api.get("/customers", { params }),
  get: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post("/customers", data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
};

// Suppliers
export const supplierAPI = {
  list: (params) => api.get("/suppliers", { params }),
  get: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post("/suppliers", data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
};

// Payments
export const paymentAPI = {
  list: (params) => api.get("/payments", { params }),
  get: (id) => api.get(`/payments/${id}`),
  create: (data) => api.post("/payments", data),
  update: (id, data) => api.put(`/payments/${id}`, data),
  delete: (id) => api.delete(`/payments/${id}`),
  stats: (params) => api.get("/payments/stats/summary", { params }),
};

// Invoices
export const invoiceAPI = {
  list: (params) => api.get("/invoices", { params }),
  get: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post("/invoices", data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  delete: (id) => api.delete(`/invoices/${id}`),
  recordPayment: (id, data) => api.post(`/invoices/${id}/record-payment`, data),
  send: (id, data) => api.post(`/invoices/${id}/send`, data),
  cancel: (id) => api.post(`/invoices/${id}/cancel`),
};

// Quotations
export const quotationAPI = {
  list: (params) => api.get("/quotations", { params }),
  get: (id) => api.get(`/quotations/${id}`),
  create: (data) => api.post("/quotations", data),
  update: (id, data) => api.put(`/quotations/${id}`, data),
  delete: (id) => api.delete(`/quotations/${id}`),
  convertToInvoice: (id, data) => api.post(`/quotations/${id}/convert-to-invoice`, data),
  send: (id, data) => api.post(`/quotations/${id}/send`, data),
};

// Admin Users
export const adminAPI = {
  list: (params) => api.get("/admins", { params }),
  get: (id) => api.get(`/admins/${id}`),
  create: (data) => api.post("/admins", data),
  update: (id, data) => api.put(`/admins/${id}`, data),
  delete: (id) => api.delete(`/admins/${id}`),
  resetPassword: (id, data) => api.post(`/admins/${id}/reset-password`, data),
};

// Tasks & Approvals / To-Do
export const taskAPI = {
  list: (params) => api.get("/tasks", { params }),
  create: (data) => api.post("/tasks", data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  updateStatus: (id, status) => api.patch(`/tasks/${id}/status`, { status }),
  delete: (id) => api.delete(`/tasks/${id}`),
};

// Sales Orders
export const salesOrderAPI = {
  list: (params) => api.get("/sales-orders", { params }),
  get: (id) => api.get(`/sales-orders/${id}`),
  create: (data) => api.post("/sales-orders", data),
  update: (id, data) => api.put(`/sales-orders/${id}`, data),
  delete: (id) => api.delete(`/sales-orders/${id}`),
};

// Products & uPVC Catalogue
export const productAPI = {
  list: (params) => api.get("/products", { params }),
  get: (id) => api.get(`/products/${id}`),
  create: (data) => api.post("/products", data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
};

// Company Settings & Multi-Bank Profiles
export const settingsAPI = {
  get: () => api.get("/settings"),
  update: (data) => api.put("/settings", data),
};

// Expenses & Accounts Management
export const expenseAPI = {
  list: (params) => api.get("/expenses", { params }),
  get: (id) => api.get(`/expenses/${id}`),
  create: (data) => api.post("/expenses", data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
};

// Employee Advance Payments
export const advancePaymentAPI = {
  list: (params) => api.get("/advance-payments", { params }),
  get: (id) => api.get(`/advance-payments/${id}`),
  create: (data) => api.post("/advance-payments", data),
  update: (id, data) => api.put(`/advance-payments/${id}`, data),
  delete: (id) => api.delete(`/advance-payments/${id}`),
};
