import { useState } from "react";

interface Props {
  displayName: string;
  profileImageUrl?: string | null;
  onProfile: () => void;
  onSettings: () => void;
  onLogout: () => void;
}

export function UserMenu({ displayName, profileImageUrl, onProfile, onSettings, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const firstName = displayName.trim().split(/\s+/)[0] ?? displayName;
  const resolvedProfileImage = profileImageUrl?.trim() ? profileImageUrl : "/default-avatar.svg";

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
          <button onClick={() => { setOpen(false); onSettings(); }}>Settings</button>
          <button className="logout-action" onClick={() => { setOpen(false); onLogout(); }}>
            <span className="logout-icon" aria-hidden="true">↪</span>
            <span>Logout</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
