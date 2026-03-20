import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ToastContainer } from "../components/ToastContainer";

export function AppShell() {
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
