import type { SelectHTMLAttributes } from "react";

interface Option {
  value: string;
  label: string;
}

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  options: Option[];
  label?: string;
}

export function Dropdown({ options, label, className = "", ...props }: Props) {
  return (
    <label style={{ display: "block" }}>
      {label ? <span className="muted" style={{ display: "block", marginBottom: 4 }}>{label}</span> : null}
      <select className={`select ${className}`.trim()} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
