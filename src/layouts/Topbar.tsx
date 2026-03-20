import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { apiClient } from "../services/apiClient";
import { UserMenu } from "../components/UserMenu";
import { useUiStore } from "../store/uiStore";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/onboarding": "Onboarding",
  "/transactions": "Transactions",
  "/categories": "Categories",
  "/accounts": "Accounts",
  "/budgets": "Budgets",
  "/goals": "Goals",
  "/reports": "Reports",
  "/recurring": "Recurring",
  "/settings": "Settings"
};

export function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { displayName, profileImageUrl, logout } = useAuthStore();
  const { selectedPeriod, setSelectedPeriod, globalSearch, setGlobalSearch, dateFrom, dateTo, setDateRange } = useUiStore();
  const pageName = pageTitles[location.pathname] ?? "Dashboard";
  const title = `Tracker | ${pageName}`;

  const monthOptions = Array.from({ length: 24 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - index);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    return { value, label };
  });

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h2 style={{ margin: 0 }}>{title}</h2>
      </div>
      <div className="topbar-right">
        <label className="topbar-filter">
          <span className="muted">Search:</span>
          <input
            className="input topbar-search"
            placeholder="Merchant or note"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
          />
        </label>
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
        <label className="topbar-period">
          <span className="muted">Month:</span>
          <select className="select topbar-period-select" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <button className="btn topbar-add-btn" type="button" onClick={() => navigate("/transactions")}>+ Add Transaction</button>
        <UserMenu
          displayName={displayName ?? "Guest User"}
          profileImageUrl={profileImageUrl}
          onProfile={() => navigate("/settings")}
          onSettings={() => navigate("/settings")}
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
    </header>
  );
}
