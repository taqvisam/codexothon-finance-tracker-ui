interface AlertBannerProps {
  type?: "info" | "warning" | "danger";
  message: string;
}

export function AlertBanner({ type = "info", message }: AlertBannerProps) {
  return <div className={`alert-banner alert-${type}`}>{message}</div>;
}
