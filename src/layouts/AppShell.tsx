import { Outlet } from "react-router-dom";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ToastContainer } from "../components/ToastContainer";
import { apiClient } from "../services/apiClient";

interface AccountItem {
  id: string;
}

export function AppShell() {
  const ONBOARDING_SKIP_KEY = "onboardingSkipped";
  const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";
  const location = useLocation();
  const onboardingSkipped = localStorage.getItem(ONBOARDING_SKIP_KEY) === "true";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true"
  );

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const accountsQuery = useQuery({
    queryKey: ["onboarding-accounts-guard"],
    queryFn: async () => (await apiClient.get<AccountItem[]>("/accounts")).data,
    initialData: []
  });

  if (accountsQuery.data.length > 0 && onboardingSkipped) {
    localStorage.removeItem(ONBOARDING_SKIP_KEY);
  }

  if (
    !accountsQuery.isLoading &&
    !accountsQuery.isFetching &&
    !accountsQuery.isError &&
    !onboardingSkipped &&
    accountsQuery.data.length === 0 &&
    location.pathname !== "/onboarding"
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className={`shell${sidebarCollapsed ? " shell-sidebar-collapsed" : ""}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
      />
      <main className="content">
        <Topbar />
        <Outlet />
        <ToastContainer />
      </main>
    </div>
  );
}
