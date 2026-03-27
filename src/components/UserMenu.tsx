import { useEffect, useRef, useState } from "react";
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
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const hasProfileImage = Boolean(profileImageUrl?.trim());
  const avatarInitial = (displayName.trim().charAt(0) || "U").toUpperCase();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [open]);

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <div className="user-dropdown" ref={dropdownRef}>
      <button
        className="user-chip"
        type="button"
        aria-label={`Open user menu for ${displayName}`}
        onClick={() => setOpen((x) => !x)}
      >
        <span className="avatar">
          {hasProfileImage ? (
            <img src={profileImageUrl ?? ""} alt={displayName} className="avatar-img" />
          ) : (
            <span className="avatar-fallback">{avatarInitial}</span>
          )}
        </span>
      </button>
      {open ? (
        <div className="user-menu">
          <div className="user-menu-profile">
            <span className="avatar user-menu-avatar">
              {hasProfileImage ? (
                <img src={profileImageUrl ?? ""} alt={displayName} className="avatar-img" />
              ) : (
                <span className="avatar-fallback">{avatarInitial}</span>
              )}
            </span>
            <strong className="user-menu-name">{displayName}</strong>
          </div>
          <button onClick={() => { setOpen(false); onProfile(); }}>My Profile</button>
          <div className="user-menu-row">
            <span className="user-menu-label">Dark mode</span>
            <button
              type="button"
              className={`user-menu-switch ${theme === "dark" ? "on" : ""}`}
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
