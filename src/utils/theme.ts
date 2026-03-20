export type ThemeMode = "light" | "dark";

const themeStorageKey = "pft-theme";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const saved = window.localStorage.getItem(themeStorageKey);
  return saved === "dark" ? "dark" : "light";
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") {
    return;
  }

  document.body.classList.toggle("dark-theme", mode === "dark");
  window.localStorage.setItem(themeStorageKey, mode);
}

