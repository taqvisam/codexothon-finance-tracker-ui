import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export function TextInput({ error, label, className = "", type, inputMode, autoComplete, ...props }: Props) {
  const isNumericField = type === "number";
  const resolvedType = isNumericField ? "text" : type;
  const resolvedInputMode = isNumericField
    ? inputMode ?? (String(props.step ?? "").includes(".") ? "decimal" : "numeric")
    : inputMode;
  const resolvedAutoComplete = isNumericField ? autoComplete ?? "off" : autoComplete;

  return (
    <label style={{ display: "block" }}>
      {label ? <span className="muted" style={{ display: "block", marginBottom: 4 }}>{label}</span> : null}
      <input
        type={resolvedType}
        inputMode={resolvedInputMode}
        autoComplete={resolvedAutoComplete}
        className={`input ${className}`.trim()}
        {...props}
      />
      {error ? <span className="error">{error}</span> : null}
    </label>
  );
}
