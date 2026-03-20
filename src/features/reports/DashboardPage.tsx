import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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

const chartColors = ["#2f6fbe", "#ee9a2f", "#36a269", "#dd5757", "#697b96", "#2f97d8"];

export function DashboardPage() {
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

  const budgetCards = budgetsQuery.data.slice(0, 4).map((budget) => {
    const percent = budget.amount > 0 ? (budget.spentAmount / budget.amount) * 100 : 0;
    return {
      ...budget,
      percent,
      level: percent >= 120 ? "danger" : percent >= 100 ? "warn" : percent >= 80 ? "warn" : "ok"
    };
  });

  const categoryData = categorySpendQuery.data.slice(0, 6).map((item, idx) => ({
    name: item.category,
    value: item.amount,
    color: chartColors[idx % chartColors.length]
  }));

  return (
    <>
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
        </ChartCard>
      </section>

      <section className="two-col">
        <article className="card">
          <h4>Recent Transactions</h4>
          {transactionsQuery.data.length === 0 ? (
            <p className="muted">No transactions yet. Add your first transaction.</p>
          ) : (
            <DataTable
              rows={transactionsQuery.data}
              columns={[
                { key: "merchant", title: "Description", render: (r) => r.merchant ?? "-" },
                { key: "date", title: "Date", render: (r) => r.date },
                { key: "amount", title: "Amount", render: (r) => currency(r.amount) }
              ]}
            />
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
                  <strong>{budget.categoryId}</strong>
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
