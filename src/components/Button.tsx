import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className = "", ...props }: Props) {
  const cls = variant === "primary" ? "btn" : variant === "danger" ? "btn danger" : "btn ghost";
  return <button className={`${cls} ${className}`.trim()} {...props} />;
}
