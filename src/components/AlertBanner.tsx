interface AlertBannerProps {
  type?: "info" | "warning" | "danger";
  message: string;
  onDismiss?: () => void;
}

export function AlertBanner({ type = "info", message, onDismiss }: AlertBannerProps) {
  return (
    <div className={`alert-banner alert-${type}`}>
      <span>{message}</span>
      {onDismiss ? (
        <button type="button" className="alert-dismiss-btn" onClick={onDismiss} aria-label="Dismiss alert">
          ×
        </button>
      ) : null}
    </div>
  );
}
