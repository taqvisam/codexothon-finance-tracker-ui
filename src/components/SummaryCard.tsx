import { useCurrency } from "../hooks/useCurrency";

interface Props {
  title: string;
  value: number;
}

export function SummaryCard({ title, value }: Props) {
  const currency = useCurrency();
  return (
    <article className="card">
      <h4>{title}</h4>
      <div className="big">{currency(value)}</div>
    </article>
  );
}
