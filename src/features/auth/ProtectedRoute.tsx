import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { apiClient } from "../../services/apiClient";

function isJwtValid(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return false;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalized));
    if (!decoded.exp) return false;
    return decoded.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function ProtectedRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    let cancelled = false;

    async function validateSession() {
      if (accessToken && isJwtValid(accessToken)) {
        if (!cancelled) setStatus("allowed");
        return;
      }

      try {
        const payload = refreshToken ? { refreshToken } : {};
        const { data } = await apiClient.post<{
          accessToken: string;
          refreshToken?: string;
          email: string;
          displayName: string;
        }>("/auth/refresh", payload);
        setAuth(data);
        if (!cancelled) setStatus("allowed");
      } catch {
        logout();
        if (!cancelled) setStatus("denied");
      }
    }

    validateSession();
    return () => {
      cancelled = true;
    };
  }, [accessToken, logout, refreshToken, setAuth]);

  if (status === "checking") {
    return <div className="card" style={{ margin: 16 }}>Checking session...</div>;
  }

  if (status === "denied") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
