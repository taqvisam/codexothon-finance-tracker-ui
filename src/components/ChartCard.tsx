import type { ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
}

export function ChartCard({ title, children }: Props) {
  return (
    <article className="card chart-card">
      <div className="card-head">
        <h4>{title}</h4>
      </div>
      {children}
    </article>
  );
}
