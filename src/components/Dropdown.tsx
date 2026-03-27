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
      <span className="select-wrap">
        <select className={`select ${className}`.trim()} {...props}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <span className="select-chevron" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none">
            <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
    </label>
  );
}
