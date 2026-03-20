import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { apiClient } from "../services/apiClient";
import { UserMenu } from "../components/UserMenu";
import { useUiStore } from "../store/uiStore";

export function Topbar() {
  const navigate = useNavigate();
  const { displayName, profileImageUrl, logout } = useAuthStore();
  const { dateFrom, dateTo, setDateRange } = useUiStore();
  const [isMobile, setIsMobile] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(true);

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
      </div>
    </header>
  );
}

