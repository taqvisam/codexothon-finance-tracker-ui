interface Props {
  value: number;
  barColor?: string;
}

export function ProgressBar({ value, barColor }: Props) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <div className="progress" aria-label="progress">
      <span style={{ width: `${bounded}%`, background: barColor }} />
    </div>
  );
}
