import { useState } from "react";
import { applyTheme, getStoredTheme, type ThemeMode } from "../utils/theme";

interface Props {
  displayName: string;
  profileImageUrl?: string | null;
  onProfile: () => void;
  onLogout: () => void;
}

export function UserMenu({ displayName, profileImageUrl, onProfile, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());
  const firstName = displayName.trim().split(/\s+/)[0] ?? displayName;
  const resolvedProfileImage = profileImageUrl?.trim() ? profileImageUrl : "/default-avatar.svg";

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <div className="user-dropdown">
      <button className="user-chip" onClick={() => setOpen((x) => !x)}>
        <span className="avatar">
          <img src={resolvedProfileImage} alt={displayName} className="avatar-img" />
        </span>
        <span>{firstName}</span>
        <span>▾</span>
      </button>
      {open ? (
        <div className="user-menu">
          <button onClick={() => { setOpen(false); onProfile(); }}>My Profile</button>
          <div className="user-menu-row">
            <div className="user-menu-meta">
              <div className="user-menu-label">Dark mode</div>
            </div>
            <button
              type="button"
              className={`settings-switch ${theme === "dark" ? "on" : ""}`}
              role="switch"
              aria-checked={theme === "dark"}
              aria-label="Toggle dark mode"
              onClick={toggleTheme}
            >
              <span />
            </button>
          </div>
          <button className="logout-action" onClick={() => { setOpen(false); onLogout(); }}>
            <span className="logout-icon" aria-hidden="true">↪</span>
            <span>Logout</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
