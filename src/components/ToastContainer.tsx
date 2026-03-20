import { useEffect } from "react";
import { useUiStore } from "../store/uiStore";

export function ToastContainer() {
  const { notifications, dismiss } = useUiStore();

  useEffect(() => {
    if (notifications.length === 0) return;
    const timers = notifications.map((n) =>
      setTimeout(() => dismiss(n.id), 3000)
    );
    return () => timers.forEach(clearTimeout);
  }, [notifications, dismiss]);

  return (
    <div style={{ position: "fixed", right: 16, top: 16, zIndex: 9999 }}>
      {notifications.map((n) => (
        <div
          key={n.id}
          className="card"
          style={{
            marginBottom: 8,
            minWidth: 220,
            borderLeft: `4px solid ${
              n.type === "error"
                ? "#d9534f"
                : n.type === "warning"
                  ? "#f0ad4e"
                  : "#2ea05f"
            }`
          }}
        >
          {n.message}
        </div>
      ))}
    </div>
  );
}
