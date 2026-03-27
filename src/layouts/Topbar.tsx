import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { apiClient } from "../services/apiClient";
import { UserMenu } from "../components/UserMenu";
import { useUiStore } from "../store/uiStore";

export function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { displayName, profileImageUrl, logout } = useAuthStore();
  const { dateFrom, dateTo, setDateRange, topbarSearch, setTopbarSearch } = useUiStore();
  const [isMobile, setIsMobile] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(true);

  const titleByPath: Record<string, string> = {
    "/": "Dashboard",
    "/transactions": "Transactions",
    "/categories": "Categories",
    "/accounts": "Accounts",
    "/budgets": "Budgets",
    "/goals": "Goals",
    "/reports": "Reports",
    "/insights": "Insights",
    "/rules": "Rules Engine",
    "/shared-accounts": "Shared Accounts",
    "/recurring": "Recurring",
    "/settings": "Settings"
  };

  const pageTitle = titleByPath[location.pathname] ?? "Personal Finance";

  useEffect(() => {
    setTopbarSearch("");
  }, [location.pathname, setTopbarSearch]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 980px)");
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      const mobile = event.matches;
      setIsMobile(mobile);
      setToolsOpen(!mobile);
    };

    handleChange(media);

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-title-block">
          <h2>{pageTitle}</h2>
          <span className="muted">Track, forecast, and optimize</span>
        </div>
        <label className="topbar-search">
          <span aria-hidden="true">⌕</span>
          <input
            className="input"
            placeholder={`Search ${pageTitle.toLowerCase()}`}
            value={topbarSearch}
            onChange={(e) => setTopbarSearch(e.target.value)}
          />
        </label>
        {isMobile ? (
          <button className="btn ghost topbar-toggle" type="button" onClick={() => setToolsOpen((value) => !value)}>
            {toolsOpen ? "Hide Filters" : "Show Filters"}
          </button>
        ) : null}
        <div className={`topbar-tools${isMobile && !toolsOpen ? " collapsed" : ""}`}>
          <label className="topbar-filter">
            <span className="muted">From:</span>
            <input
              className="input topbar-date"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateRange(e.target.value, dateTo)}
            />
          </label>
          <label className="topbar-filter">
            <span className="muted">To:</span>
            <input
              className="input topbar-date"
              type="date"
              value={dateTo}
              onChange={(e) => setDateRange(dateFrom, e.target.value)}
            />
          </label>
          <button className="btn topbar-add-btn" type="button" onClick={() => navigate("/transactions")}>+ Add Transaction</button>
        </div>
        <div className="topbar-user">
          <UserMenu
            displayName={displayName ?? "Guest User"}
            profileImageUrl={profileImageUrl}
            onProfile={() => navigate("/settings")}
            onLogout={async () => {
              try
              {
                await apiClient.post("/auth/logout");
              }
              catch
              {
              }
              logout();
              navigate("/login");
            }}
          />
        </div>
      </div>
    </header>
  );
}

