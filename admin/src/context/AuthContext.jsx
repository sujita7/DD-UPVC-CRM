import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authAPI } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ── Initialize session ──────────────────────────────────────────────────────
  const initialize = useCallback(async () => {
    const token = localStorage.getItem("crm_access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await authAPI.me();
      setAdmin(data.admin);
      setIsAuthenticated(true);
    } catch {
      // Try refresh
      try {
        const { data: refreshData } = await authAPI.refresh();
        localStorage.setItem("crm_access_token", refreshData.accessToken);
        const { data: meData } = await authAPI.me();
        setAdmin(meData.admin);
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem("crm_access_token");
        setAdmin(null);
        setIsAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // ── Login ────────────────────────────────────────────────────────────────────
  const login = async (email, password, remember = false) => {
    const { data } = await authAPI.login({ email, password, remember });
    localStorage.setItem("crm_access_token", data.accessToken);
    setAdmin(data.admin);
    setIsAuthenticated(true);
    return data;
  };

  // ── Logout ───────────────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      await authAPI.logout();
    } catch {}
    localStorage.removeItem("crm_access_token");
    setAdmin(null);
    setIsAuthenticated(false);
  };

  // ── Update Profile ───────────────────────────────────────────────────────────
  const updateProfile = (updates) => {
    setAdmin((prev) => ({ ...prev, ...updates }));
  };

  const value = {
    admin,
    loading,
    isAuthenticated,
    login,
    logout,
    updateProfile,
    refetch: initialize,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
