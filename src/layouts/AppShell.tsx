import { Outlet } from "react-router-dom";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ToastContainer } from "../components/ToastContainer";
import { apiClient } from "../services/apiClient";

interface AccountItem {
  id: string;
}

export function AppShell() {
  const location = useLocation();
  const accountsQuery = useQuery({
    queryKey: ["onboarding-accounts-guard"],
    queryFn: async () => (await apiClient.get<AccountItem[]>("/accounts")).data,
    initialData: []
  });

  if (!accountsQuery.isLoading && !accountsQuery.isFetching && accountsQuery.data.length === 0 && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="shell">
      <Sidebar />
      <main className="content">
        <Topbar />
        <Outlet />
        <ToastContainer />
      </main>
    </div>
  );
}
