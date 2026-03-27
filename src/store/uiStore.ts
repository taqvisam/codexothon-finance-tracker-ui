import { create } from "zustand";

export interface AppNotification {
  id: string;
  message: string;
  type: "success" | "warning" | "error";
}

interface UiState {
  selectedPeriod: string;
  dateFrom: string;
  dateTo: string;
  topbarSearch: string;
  notifications: AppNotification[];
  setSelectedPeriod: (period: string) => void;
  setDateRange: (from: string, to: string) => void;
  setTopbarSearch: (value: string) => void;
  notify: (message: string, type?: AppNotification["type"]) => void;
  dismiss: (id: string) => void;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function toPeriod(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function periodWindow(period: string) {
  const [yearText, monthText] = period.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

const today = new Date();
const defaultPeriod = toPeriod(today);
const defaultWindow = periodWindow(defaultPeriod);

export const useUiStore = create<UiState>((set) => ({
  selectedPeriod: defaultPeriod,
  dateFrom: defaultWindow.from,
  dateTo: defaultWindow.to,
  topbarSearch: "",
  notifications: [],
  setSelectedPeriod: (period) =>
    set(() => {
      const window = periodWindow(period);
      return { selectedPeriod: period, dateFrom: window.from, dateTo: window.to };
    }),
  setDateRange: (from, to) =>
    set((state) => {
      const fromDate = parseIsoDate(from);
      const toDate = parseIsoDate(to);
      if (!fromDate || !toDate) {
        return state;
      }

      const start = fromDate <= toDate ? fromDate : toDate;
      const end = fromDate <= toDate ? toDate : fromDate;

      return {
        dateFrom: toIsoDate(start),
        dateTo: toIsoDate(end),
        selectedPeriod: toPeriod(start)
      };
    }),
  setTopbarSearch: (value) => set(() => ({ topbarSearch: value })),
  notify: (message, type = "success") =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { id: crypto.randomUUID(), message, type }
      ]
    })),
  dismiss: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id)
    }))
}));
