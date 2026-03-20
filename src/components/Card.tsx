import type { ReactNode } from "react";

interface Props {
  title?: string;
  children: ReactNode;
}

export function Card({ title, children }: Props) {
  return (
    <section className="card">
      {title ? <h4>{title}</h4> : null}
      {children}
    </section>
  );
}
