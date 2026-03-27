import { NavLink } from "react-router-dom";

function NavIcon({ path }: { path: string }) {
  return (
    <svg className="nav-icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={path} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const items = [
  ["M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3v-10.5Z", "Dashboard", "/"],
  ["M3 6h18M3 12h18M3 18h18", "Transactions", "/transactions"],
  ["M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z", "Categories", "/categories"],
  ["M4 7h16v12H4z M4 11h16", "Accounts", "/accounts"],
  ["M7 4v4M17 4v4M4 9h16M5 7h14a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z", "Budgets", "/budgets"],
  ["M12 21s7-4.3 7-10V5l-7-2-7 2v6c0 5.7 7 10 7 10Z", "Goals", "/goals"],
  ["M4 17V7m6 10V4m6 13v-7m4 11H2", "Reports", "/reports"],
  ["M4 12h4l2-5 4 10 2-5h4", "Insights", "/insights"],
  ["M5 7h14M5 12h8M5 17h12M18 7l1.5-1.5M18 17l1.5 1.5", "Rules", "/rules"],
  ["M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M16 3.1a4 4 0 0 1 0 7.8M23 21v-2a4 4 0 0 0-3-3.9M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z", "Shared", "/shared-accounts"],
  ["M8 8a6 6 0 1 1-1 8M8 8V4M8 8h4", "Recurring", "/recurring"],
  ["M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Zm8-3.5-2.1.7a6.9 6.9 0 0 1-.4 1l1.2 1.9-1.9 1.9-1.9-1.2c-.3.2-.7.3-1 .4L12 20l-1.2-2.1c-.4-.1-.7-.2-1-.4l-1.9 1.2-1.9-1.9 1.2-1.9a6.9 6.9 0 0 1-.4-1L4 12l2.1-1.2c.1-.4.2-.7.4-1L5.3 7.9 7.2 6l1.9 1.2c.3-.2.6-.3 1-.4L12 4l1.2 2.1c.4.1.7.2 1 .4L16.1 5.3 18 7.2l-1.2 1.9c.2.3.3.6.4 1L20 12Z", "Settings", "/settings"]
] as const;

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

function ToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={`sidebar-toggle-icon${collapsed ? " expanded" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M14.5 6.5 9 12l5.5 5.5M19.5 6.5 14 12l5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="brand-block">
        <div className="brand-main">
          <div className="brand-mark" aria-hidden="true">◎</div>
          <div className="brand-text">Personal Finance</div>
        </div>
        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand side menu" : "Collapse side menu"}
          title={collapsed ? "Expand side menu" : "Collapse side menu"}
        >
          <ToggleIcon collapsed={collapsed} />
        </button>
      </div>
      <nav className="sidebar-nav">
        {items.map(([iconPath, label, path]) => (
          <NavLink
            key={path}
            to={path}
            title={label}
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            <span className="nav-icon"><NavIcon path={iconPath} /></span>
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot">
        <span>{collapsed ? "V2" : "Version 2"}</span>
      </div>
    </aside>
  );
}
