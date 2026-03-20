import type { ButtonHTMLAttributes } from "react";

type ActionIcon = "edit" | "delete";

interface ActionIconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: ActionIcon;
  label: string;
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0 0-3L17.5 5a2.1 2.1 0 0 0-3 0L4 15.5V20Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m13.5 6 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 3h4a1 1 0 0 1 1 1v2H9V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7l1 13a1.6 1.6 0 0 0 1.6 1.5h4.8A1.6 1.6 0 0 0 16 20L17 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ActionIconButton({ icon, label, className = "", type = "button", ...props }: ActionIconButtonProps) {
  const toneClass = icon === "delete" ? "danger" : "";

  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      className={`action-icon-btn ${toneClass} ${className}`.trim()}
      {...props}
    >
      {icon === "edit" ? <EditIcon /> : <DeleteIcon />}
    </button>
  );
}

