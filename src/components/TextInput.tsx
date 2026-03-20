import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export function TextInput({ error, label, className = "", ...props }: Props) {
  return (
    <label style={{ display: "block" }}>
      {label ? <span className="muted" style={{ display: "block", marginBottom: 4 }}>{label}</span> : null}
      <input className={`input ${className}`.trim()} {...props} />
      {error ? <span className="error">{error}</span> : null}
    </label>
  );
}
