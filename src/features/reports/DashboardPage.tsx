import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
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

const chartColors = ["#2f6fbe", "#ee9a2f", "#36a269", "#dd5757", "#697b96", "#2f97d8"];

export function DashboardPage() {
  const navigate = useNavigate();
  const currency = useCurrency();
  const { dateFrom, dateTo, selectedPeriod } = useUiStore();
  const [selectedYear, selectedMonth] = selectedPeriod.split("-").map(Number);

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
          type: severity as "info" | "warning" | "danger",
          message: `${b.categoryName}: ${Math.round(b.percent)}% of budget used`
        };
      });

    const recurringAlerts = recurringQuery.data
      .filter((r) => r.nextRunDate >= dateFrom && r.nextRunDate <= end)
      .slice(0, 3)
      .map((r) => ({
        type: "warning" as const,
        message: `Upcoming recurring payment in next 3 days: ${r.title} (${currency(r.amount)}) on ${r.nextRunDate}`
      }));

    return [...budgetAlerts, ...recurringAlerts];
  }, [budgetCards, currency, dateFrom, recurringQuery.data]);

  return (
    <>
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
              <AlertBanner key={`${idx}-${alert.message}`} type={alert.type} message={alert.message} />
            ))}
          </div>
        ) : null}
      </section>

      <section className="card-grid">
        <SummaryCard title="Balance" value={summary.balance} />
        <SummaryCard title="Current Month Income" value={summary.income} />
        <SummaryCard title="Current Month Expense" value={summary.expense} />
        <SummaryCard title="Savings" value={summary.savings} />
      </section>

      <section className="two-col">
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
      </section>

      <section className="two-col">
        <article className="card">
          <h4>Recent Transactions</h4>
          {transactionsQuery.data.length === 0 ? (
            <p className="muted">No transactions yet. Add your first transaction.</p>
          ) : (
            <>
              <DataTable
                rows={transactionsQuery.data.slice(0, 5)}
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
        <article className="card">
          <h4>Upcoming Recurring Payments</h4>
          <DataTable
            rows={recurringQuery.data
              .filter((x) => x.nextRunDate >= dateFrom && x.nextRunDate <= dateTo)
              .slice(0, 5)
              .map((x) => ({ name: x.title, amount: x.amount, due: x.nextRunDate }))}
            columns={[
              { key: "name", title: "Bill", render: (r) => r.name },
              { key: "amount", title: "Amount", render: (r) => currency(r.amount) },
              { key: "due", title: "Due", render: (r) => r.due }
            ]}
          />
        </article>
      </section>

      <section className="two-col">
        <article className="card">
          <h4>Budget Progress Cards</h4>
          {budgetCards.length === 0 ? (
            <p className="muted">No budgets yet.</p>
          ) : (
            budgetCards.map((budget) => (
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

        <article className="card">
          <h4>Savings Goal Progress</h4>
          {goalsQuery.data.length === 0 ? (
            <p className="muted">No goals yet.</p>
          ) : (
            goalsQuery.data.slice(0, 4).map((goal) => (
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
      </section>
    </>
  );
}
