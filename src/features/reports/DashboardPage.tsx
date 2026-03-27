import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ChartCard } from "../../components/ChartCard";
import { DataTable } from "../../components/DataTable";
import { ProgressBar } from "../../components/ProgressBar";
import { SummaryCard } from "../../components/SummaryCard";
import { apiClient } from "../../services/apiClient";
import type { BudgetItem, GoalItem, SummaryMetrics, TransactionItem } from "../../types";
import { useCurrency } from "../../hooks/useCurrency";
import { useUiStore } from "../../store/uiStore";
import { AlertBanner } from "../../components/AlertBanner";

interface AccountItem {
  id: string;
  name: string;
  currentBalance: number;
}

interface CategorySpend {
  category: string;
  amount: number;
}

interface TrendItem {
  month: string;
  income: number;
  expense: number;
}

interface CategoryItem {
  id: string;
  name: string;
}

interface ForecastMonth {
  year: number;
  month: number;
  currentBalance: number;
  projectedIncome: number;
  projectedExpense: number;
  upcomingKnownExpenses: number;
  forecastedEndBalance: number;
  safeToSpend: number;
  confidenceScore: number;
  model: string;
  estimatedNegativeDate?: string | null;
  riskWarnings: string[];
}

interface ForecastDailyPoint {
  date: string;
  projectedBalance: number;
}

interface HealthScoreFactor {
  name: string;
  score: number;
  description: string;
}

interface HealthScore {
  score: number;
  breakdown: HealthScoreFactor[];
  suggestions: string[];
}

const chartColors = ["#2f6fbe", "#ee9a2f", "#36a269", "#dd5757", "#697b96", "#2f97d8"];

function MobileSection({
  title,
  isMobile,
  defaultOpen = false,
  children
}: {
  title: string;
  isMobile: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <details className="mobile-collapse" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="mobile-collapse-body">{children}</div>
    </details>
  );
}

export function DashboardPage() {
  const DISMISSED_ALERTS_KEY = "pft-dashboard-dismissed-alerts";
  const navigate = useNavigate();
  const currency = useCurrency();
  const { dateFrom, dateTo, selectedPeriod, topbarSearch } = useUiStore();
  const [selectedYear, selectedMonth] = selectedPeriod.split("-").map(Number);
  const [isMobile, setIsMobile] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>(() => {
    const raw = localStorage.getItem(DISMISSED_ALERTS_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const media = window.matchMedia("(max-width: 980px)");
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(event.matches);
    };

    handleChange(media);

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  const transactionsQuery = useQuery({
    queryKey: ["recent-transactions", dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await apiClient.get<TransactionItem[]>("/transactions", {
        params: { from: dateFrom, to: dateTo, page: 1, pageSize: 5 }
      });
      return data;
    },
    initialData: []
  });

  const accountsQuery = useQuery({
    queryKey: ["dashboard-accounts"],
    queryFn: async () => (await apiClient.get<AccountItem[]>("/accounts")).data,
    initialData: []
  });

  const goalsQuery = useQuery({
    queryKey: ["dashboard-goals"],
    queryFn: async () => (await apiClient.get<GoalItem[]>("/goals")).data,
    initialData: []
  });

  const budgetsQuery = useQuery({
    queryKey: ["dashboard-budgets", selectedPeriod],
    queryFn: async () =>
      (
        await apiClient.get<BudgetItem[]>("/budgets", {
          params: { month: selectedMonth, year: selectedYear }
        })
      ).data,
    initialData: []
  });

  const categoriesQuery = useQuery({
    queryKey: ["dashboard-categories"],
    queryFn: async () => (await apiClient.get<CategoryItem[]>("/categories")).data,
    initialData: []
  });

  const recurringQuery = useQuery({
    queryKey: ["dashboard-recurring"],
    queryFn: async () =>
      (
        await apiClient.get<{ title: string; amount: number; nextRunDate: string }[]>("/recurring")
      ).data,
    initialData: []
  });

  const categorySpendQuery = useQuery({
    queryKey: ["dashboard-category-spend", dateFrom, dateTo],
    queryFn: async () =>
      (
        await apiClient.get<CategorySpend[]>("/reports/category-spend", {
          params: { from: dateFrom, to: dateTo }
        })
      ).data,
    initialData: []
  });

  const trendQuery = useQuery({
    queryKey: ["dashboard-income-expense", dateFrom, dateTo],
    queryFn: async () =>
      (
        await apiClient.get<TrendItem[]>("/reports/income-vs-expense", {
          params: { from: dateFrom, to: dateTo }
        })
      ).data,
    initialData: []
  });

  const forecastMonthQuery = useQuery({
    queryKey: ["dashboard-forecast-month"],
    queryFn: async () => (await apiClient.get<ForecastMonth>("/forecast/month")).data
  });

  const forecastDailyQuery = useQuery({
    queryKey: ["dashboard-forecast-daily"],
    queryFn: async () => (await apiClient.get<ForecastDailyPoint[]>("/forecast/daily")).data,
    initialData: []
  });

  const healthScoreQuery = useQuery({
    queryKey: ["dashboard-health-score"],
    queryFn: async () => (await apiClient.get<HealthScore>("/insights/health-score")).data
  });

  const summary = useMemo<SummaryMetrics>(() => {
    const balance = accountsQuery.data.reduce((sum, a) => sum + a.currentBalance, 0);
    const income = trendQuery.data.reduce((sum, row) => sum + row.income, 0);
    const expense = trendQuery.data.reduce((sum, row) => sum + row.expense, 0);
    const savings = goalsQuery.data.reduce((sum, goal) => sum + goal.currentAmount, 0);
    return { balance, income, expense, savings };
  }, [accountsQuery.data, goalsQuery.data, trendQuery.data]);

  const categoryNameById = useMemo(
    () => new Map(categoriesQuery.data.map((category) => [category.id, category.name])),
    [categoriesQuery.data]
  );

  const budgetCards = budgetsQuery.data.slice(0, 4).map((budget) => {
    const percent = budget.amount > 0 ? (budget.spentAmount / budget.amount) * 100 : 0;
    return {
      ...budget,
      categoryName: categoryNameById.get(budget.categoryId) ?? budget.categoryId,
      percent,
      level: percent >= 120 ? "danger" : percent >= 100 ? "warn" : percent >= 80 ? "warn" : "ok"
    };
  });

  const categoryData = categorySpendQuery.data.slice(0, 6).map((item, idx) => ({
    name: item.category,
    value: item.amount,
    color: chartColors[idx % chartColors.length]
  }));

  const alerts = useMemo(() => {
    const nextThreeDays = new Date();
    nextThreeDays.setDate(nextThreeDays.getDate() + 3);
    const end = nextThreeDays.toISOString().slice(0, 10);

    const budgetAlerts = budgetCards
      .filter((b) => b.percent >= 80)
      .map((b) => {
        const severity = b.percent >= 120 ? "danger" : b.percent >= 100 ? "warning" : "info";
        return {
          key: `budget:${b.categoryName}:${Math.round(b.percent)}`,
          type: severity as "info" | "warning" | "danger",
          message: `${b.categoryName}: ${Math.round(b.percent)}% of budget used`
        };
      });

    const recurringAlerts = recurringQuery.data
      .filter((r) => r.nextRunDate >= dateFrom && r.nextRunDate <= end)
      .slice(0, 3)
      .map((r) => ({
        key: `recurring:${r.title}:${r.nextRunDate}`,
        type: "warning" as const,
        message: `Upcoming recurring payment in next 3 days: ${r.title} (${currency(r.amount)}) on ${r.nextRunDate}`
      }));

    const forecastWarnings = (forecastMonthQuery.data?.riskWarnings ?? []).map((warning) => ({
      key: `forecast:${warning}`,
      type: "warning" as const,
      message: warning
    }));

    return [...budgetAlerts, ...recurringAlerts, ...forecastWarnings].filter(
      (alert) => !dismissedAlerts.includes(alert.key)
    );
  }, [budgetCards, currency, dateFrom, dismissedAlerts, forecastMonthQuery.data?.riskWarnings, recurringQuery.data]);

  const dismissAlert = (key: string) => {
    setDismissedAlerts((prev) => {
      if (prev.includes(key)) return prev;
      const next = [...prev, key];
      localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const forecastDelta = useMemo(() => {
    if (!forecastDailyQuery.data.length) {
      return 0;
    }
    const first = forecastDailyQuery.data[0]?.projectedBalance ?? 0;
    const last = forecastDailyQuery.data[forecastDailyQuery.data.length - 1]?.projectedBalance ?? 0;
    return last - first;
  }, [forecastDailyQuery.data]);

  const pulseMatrix = useMemo(() => {
    return forecastDailyQuery.data.slice(0, 12).map((point, index, list) => {
      const previousBalance = index === 0 ? forecastMonthQuery.data?.currentBalance ?? point.projectedBalance : list[index - 1]?.projectedBalance ?? point.projectedBalance;
      const change = point.projectedBalance - previousBalance;
      const intensity = Math.min(100, Math.round((Math.abs(change) / Math.max(Math.abs(previousBalance), 1)) * 1600));
      const tone =
        point.projectedBalance < 0 ? "critical" :
        change >= 0 ? "positive" :
        Math.abs(change) < 75 ? "steady" :
        "negative";

      return {
        date: point.date,
        label: new Date(point.date).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        balance: point.projectedBalance,
        change,
        intensity,
        tone
      };
    });
  }, [forecastDailyQuery.data, forecastMonthQuery.data?.currentBalance]);

  const pulseSummary = useMemo(() => {
    if (!pulseMatrix.length) {
      return {
        stableDays: 0,
        pressureDays: 0,
        growthDays: 0
      };
    }

    return pulseMatrix.reduce(
      (acc, point) => {
        if (point.tone === "positive") acc.growthDays += 1;
        if (point.tone === "negative" || point.tone === "critical") acc.pressureDays += 1;
        if (point.tone === "steady") acc.stableDays += 1;
        return acc;
      },
      { stableDays: 0, pressureDays: 0, growthDays: 0 }
    );
  }, [pulseMatrix]);

  const normalizedSearch = topbarSearch.trim().toLowerCase();
  const filteredRecentTransactions = useMemo(() => {
    const rows = transactionsQuery.data.slice(0, 5);
    if (!normalizedSearch) {
      return rows;
    }

    return rows.filter((item) =>
      [item.merchant ?? "", item.note ?? "", item.date, item.type, String(item.amount)]
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [normalizedSearch, transactionsQuery.data]);

  const filteredRecurringPayments = useMemo(() => {
    const rows = recurringQuery.data
      .filter((x) => x.nextRunDate >= dateFrom && x.nextRunDate <= dateTo)
      .slice(0, 5)
      .map((x) => ({ name: x.title, amount: x.amount, due: x.nextRunDate }));

    if (!normalizedSearch) {
      return rows;
    }

    return rows.filter((item) =>
      [item.name, item.due, String(item.amount)].some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [dateFrom, dateTo, normalizedSearch, recurringQuery.data]);

  const filteredBudgetCards = useMemo(() => {
    if (!normalizedSearch) {
      return budgetCards;
    }

    return budgetCards.filter((budget) =>
      [budget.categoryName, String(budget.amount), String(budget.spentAmount), String(budget.percent)]
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [budgetCards, normalizedSearch]);

  const filteredGoalCards = useMemo(() => {
    const rows = goalsQuery.data.slice(0, 4);
    if (!normalizedSearch) {
      return rows;
    }

    return rows.filter((goal) =>
      [goal.name, goal.status ?? "", String(goal.targetAmount), String(goal.currentAmount), String(goal.progressPercent)]
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [goalsQuery.data, normalizedSearch]);

  return (
    <>
      <MobileSection title="Quick Actions & Alerts" isMobile={isMobile}>
        <section className="card" style={{ marginTop: 12 }}>
          <div className="quick-actions">
            <button className="btn" type="button" onClick={() => navigate("/transactions")}>Add Transaction</button>
            <button className="btn ghost" type="button" onClick={() => navigate("/budgets")}>Create Budget</button>
            <button className="btn ghost" type="button" onClick={() => navigate("/recurring")}>Add Recurring Bill</button>
            <button className="btn ghost" type="button" onClick={() => navigate("/goals")}>Update Goal Contribution</button>
          </div>
          {alerts.length > 0 ? (
            <div className="alert-stack">
              {alerts.map((alert, idx) => (
                <AlertBanner
                  key={`${idx}-${alert.key}`}
                  type={alert.type}
                  message={alert.message}
                  onDismiss={() => dismissAlert(alert.key)}
                />
              ))}
            </div>
          ) : null}
        </section>
      </MobileSection>

      <section className="card-grid dashboard-summary-grid">
        <SummaryCard title="Balance" value={summary.balance} />
        <SummaryCard title="Current Month Income" value={summary.income} />
        <SummaryCard title="Current Month Expense" value={summary.expense} />
        <SummaryCard title="Savings" value={summary.savings} />
        <SummaryCard
          title="Projected Balance"
          value={forecastMonthQuery.data?.forecastedEndBalance ?? summary.balance}
          infoText="Calculated as current balance plus projected income minus projected expense and upcoming known expenses for the rest of the month."
        />
        <article className="card">
          <div className="summary-card-head">
            <h4>Financial Health Score</h4>
            <span className="summary-info-wrap" tabIndex={0} aria-label="Financial Health Score calculation info">
              <span className="summary-info-icon" aria-hidden="true">i</span>
              <span className="summary-info-tooltip" role="tooltip">
                Score is calculated from savings rate, expense stability, budget adherence, and cash buffer, normalized to a 0 to 100 scale.
              </span>
            </span>
          </div>
          <div className="big">{Math.round(healthScoreQuery.data?.score ?? 0)}</div>
          <div className="summary-card-link-row">
            <button className="summary-card-link" type="button" onClick={() => navigate("/insights")}>
              View breakdown
            </button>
          </div>
        </article>
      </section>

      <section className="two-col">
        <MobileSection title="Forecast (Daily Projection)" isMobile={isMobile}>
          <ChartCard title="Cash Flow Forecast Engine">
            <div className="forecast-header">
              <div className="forecast-kpi">
                <span className="muted">Safe to spend</span>
                <strong>{currency(forecastMonthQuery.data?.safeToSpend ?? 0)}</strong>
              </div>
              <div className="forecast-kpi">
                <span className="muted">Confidence</span>
                <strong>{Math.round(forecastMonthQuery.data?.confidenceScore ?? 0)}%</strong>
              </div>
              <div className={`forecast-kpi ${forecastDelta >= 0 ? "trend-up" : "trend-down"}`}>
                <span className="muted">Projected momentum</span>
                <strong>{forecastDelta >= 0 ? "+" : ""}{currency(forecastDelta)}</strong>
              </div>
            </div>

            <div className="forecast-chart-wrap">
              {forecastDailyQuery.data.length === 0 ? (
                <p className="muted">No forecast data.</p>
              ) : (
                <ResponsiveContainer>
                  <LineChart data={forecastDailyQuery.data}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value) => currency(Number(value ?? 0))}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="projectedBalance"
                      stroke="#2f7be2"
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {forecastMonthQuery.data ? (
              <div className="forecast-meta">
                <span className="forecast-chip">Model: {forecastMonthQuery.data.model}</span>
                <span className="forecast-chip">
                  Known upcoming expenses: {currency(forecastMonthQuery.data.upcomingKnownExpenses)}
                </span>
                {forecastMonthQuery.data.estimatedNegativeDate ? (
                  <span className="forecast-chip danger">
                    Risk date: {forecastMonthQuery.data.estimatedNegativeDate}
                  </span>
                ) : (
                  <span className="forecast-chip ok">No negative-balance date predicted</span>
                )}
              </div>
            ) : null}
          </ChartCard>
        </MobileSection>
        <MobileSection title="Spending by Category" isMobile={isMobile}>
          <ChartCard title="Money Pulse Matrix">
            {pulseMatrix.length === 0 ? (
              <p className="muted">No forecast pulse available yet.</p>
            ) : (
              <>
                <div className="pulse-matrix">
                  {pulseMatrix.map((point) => (
                    <div
                      key={point.date}
                      className={`pulse-cell pulse-${point.tone}`}
                      style={{ opacity: Math.max(0.35, point.intensity / 100) }}
                      title={`${point.label} | Balance ${currency(point.balance)} | Change ${point.change >= 0 ? "+" : ""}${currency(point.change)}`}
                    >
                      <span>{point.label}</span>
                      <strong>{point.change >= 0 ? "+" : ""}{currency(point.change)}</strong>
                    </div>
                  ))}
                </div>

                <div className="pulse-summary">
                  <div className="pulse-summary-card">
                    <span className="muted">Growth days</span>
                    <strong>{pulseSummary.growthDays}</strong>
                  </div>
                  <div className="pulse-summary-card">
                    <span className="muted">Stable days</span>
                    <strong>{pulseSummary.stableDays}</strong>
                  </div>
                  <div className="pulse-summary-card">
                    <span className="muted">Pressure days</span>
                    <strong>{pulseSummary.pressureDays}</strong>
                  </div>
                </div>

                <div className="pulse-legend">
                  <span className="pulse-legend-item"><i className="pulse-dot pulse-positive" /> Rising balance</span>
                  <span className="pulse-legend-item"><i className="pulse-dot pulse-steady" /> Stable</span>
                  <span className="pulse-legend-item"><i className="pulse-dot pulse-negative" /> Cash pressure</span>
                  <span className="pulse-legend-item"><i className="pulse-dot pulse-critical" /> Below zero</span>
                </div>
              </>
            )}
          </ChartCard>
        </MobileSection>
        <MobileSection title="Spending by Category" isMobile={isMobile}>
          <ChartCard title="Spending by Category">
            <div style={{ height: 220 }}>
              {categoryData.length === 0 ? (
                <p className="muted">No category spend data.</p>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={45}>
                      {categoryData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {categoryData.length > 0 ? (
              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                {categoryData.map((item) => (
                  <div key={`legend-${item.name}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: item.color,
                        border: "1px solid rgba(0,0,0,0.08)"
                      }}
                    />
                    <span className="muted">{item.name}: {currency(item.value)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </ChartCard>
        </MobileSection>
        <MobileSection title="Income vs Expense Trend" isMobile={isMobile}>
          <ChartCard title="Income vs Expense Trend">
            <div style={{ height: 220 }}>
              {trendQuery.data.length === 0 ? (
                <p className="muted">No income/expense data.</p>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={trendQuery.data}>
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Bar dataKey="income" fill="#2f6fbe" />
                    <Bar dataKey="expense" fill="#dd5757" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            {trendQuery.data.length > 0 ? (
              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: "#2f6fbe",
                      border: "1px solid rgba(0,0,0,0.08)"
                    }}
                  />
                  <span className="muted">Income</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: "#dd5757",
                      border: "1px solid rgba(0,0,0,0.08)"
                    }}
                  />
                  <span className="muted">Expense</span>
                </div>
              </div>
            ) : null}
          </ChartCard>
        </MobileSection>
      </section>

      <section className="two-col">
        <article className="card">
          <h4>Recent Transactions</h4>
          {transactionsQuery.data.length === 0 ? (
            <p className="muted">No transactions yet. Add your first transaction.</p>
          ) : filteredRecentTransactions.length === 0 ? (
            <p className="muted">No recent transactions match your search.</p>
          ) : (
            <>
              <DataTable
                rows={filteredRecentTransactions}
                columns={[
                  { key: "merchant", title: "Description", render: (r) => r.merchant ?? "-" },
                  { key: "date", title: "Date", render: (r) => r.date },
                  { key: "amount", title: "Amount", render: (r) => currency(r.amount) }
                ]}
              />
              <div className="section-link-row">
                <button
                  type="button"
                  onClick={() => navigate("/transactions")}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "#2f6fbe",
                    cursor: "pointer",
                    fontWeight: 600,
                    padding: 0
                  }}
                >
                  View more
                </button>
              </div>
            </>
          )}
        </article>
        <MobileSection title="Upcoming Recurring Payments" isMobile={isMobile}>
          <article className="card">
            <h4>Upcoming Recurring Payments</h4>
            {filteredRecurringPayments.length === 0 ? (
              <p className="muted">No recurring payments match your search.</p>
            ) : (
              <DataTable
                rows={filteredRecurringPayments}
                columns={[
                  { key: "name", title: "Bill", render: (r) => r.name },
                  { key: "amount", title: "Amount", render: (r) => currency(r.amount) },
                  { key: "due", title: "Due", render: (r) => r.due }
                ]}
              />
            )}
          </article>
        </MobileSection>
      </section>

      <section className="two-col">
        <MobileSection title="Budget Progress Cards" isMobile={isMobile}>
          <article className="card">
            <h4>Budget Progress Cards</h4>
            {budgetCards.length === 0 ? (
              <p className="muted">No budgets yet.</p>
            ) : filteredBudgetCards.length === 0 ? (
              <p className="muted">No budget cards match your search.</p>
            ) : (
              filteredBudgetCards.map((budget) => (
                <div key={budget.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{budget.categoryName}</strong>
                    <span>{Math.round(budget.percent)}%</span>
                  </div>
                  <ProgressBar value={budget.percent} />
                  <span className={`muted budget-${budget.level}`}>
                    {currency(budget.spentAmount)} / {currency(budget.amount)}
                  </span>
                </div>
              ))
            )}
          </article>
        </MobileSection>

        <MobileSection title="Savings Goal Progress" isMobile={isMobile}>
          <article className="card">
            <h4>Savings Goal Progress</h4>
            {goalsQuery.data.length === 0 ? (
              <p className="muted">No goals yet.</p>
            ) : filteredGoalCards.length === 0 ? (
              <p className="muted">No goals match your search.</p>
            ) : (
              filteredGoalCards.map((goal) => (
                <div key={goal.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{goal.name}</strong>
                    <span className="muted">{Math.round(goal.progressPercent)}%</span>
                  </div>
                  <ProgressBar value={goal.progressPercent} />
                </div>
              ))
            )}
          </article>
        </MobileSection>
      </section>
    </>
  );
}
