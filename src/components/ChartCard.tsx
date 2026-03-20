import type { ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
}

export function ChartCard({ title, children }: Props) {
  return (
    <article className="card">
      <h4>{title}</h4>
      {children}
    </article>
  );
}
