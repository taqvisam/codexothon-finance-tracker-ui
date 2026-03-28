import { useCurrency } from "../hooks/useCurrency";

interface Props {
  title: string;
  value: number;
  infoText?: string;
  valueClassName?: string;
}

export function SummaryCard({ title, value, infoText, valueClassName = "" }: Props) {
  const currency = useCurrency();
  return (
    <article className="card summary-card">
      <div className="summary-card-head">
        <h4>{title}</h4>
        {infoText ? (
          <span className="summary-info-wrap" tabIndex={0} aria-label={`${title} calculation info`}>
            <span className="summary-info-icon" aria-hidden="true">i</span>
            <span className="summary-info-tooltip" role="tooltip">{infoText}</span>
          </span>
        ) : null}
      </div>
      <div className={`big ${valueClassName}`.trim()}>{currency(value)}</div>
    </article>
  );
}
