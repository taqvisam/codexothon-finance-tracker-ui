import { useQuery } from "@tanstack/react-query";
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
import { apiClient } from "../../services/apiClient";
import { useUiStore } from "../../store/uiStore";
import { useState } from "react";

const piePalette = ["#2f6fbe", "#36a269", "#ee9a2f", "#dd5757", "#7a5fd3", "#31a4c8", "#8a6b56", "#d46d9f"];

function colorForCategory(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return piePalette[hash % piePalette.length];
}

export function ReportsPage() {
  const { dateFrom: from, dateTo: to } = useUiStore();
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState("");
  const categorySpendQuery = useQuery({
    queryKey: ["report-category", from, to, accountId, categoryId, type],
    queryFn: async () =>
      (
        await apiClient.get<{ category: string; amount: number }[]>("/reports/category-spend", {
          params: { from, to, accountId: accountId || undefined, categoryId: categoryId || undefined, type: type || undefined }
        })
      ).data,
    initialData: []
  });
  const trendQuery = useQuery({
    queryKey: ["report-trend", from, to, accountId, categoryId, type],
    queryFn: async () =>
      (
        await apiClient.get<{ month: string; income: number; expense: number }[]>("/reports/income-vs-expense", {
          params: { from, to, accountId: accountId || undefined, categoryId: categoryId || undefined, type: type || undefined }
        })
      ).data,
    initialData: []
  });
  const accountTrendQuery = useQuery({
    queryKey: ["report-account-trend", from, to, accountId, categoryId, type],
    queryFn: async () =>
      (
        await apiClient.get<{ date: string; accountName: string; balance: number }[]>("/reports/account-balance-trend", {
          params: { from, to, accountId: accountId || undefined, categoryId: categoryId || undefined, type: type || undefined }
        })
      ).data,
    initialData: []
  });
  const savingsQuery = useQuery({
    queryKey: ["report-savings-progress"],
    queryFn: async () => (await apiClient.get<{ name: string; currentAmount: number; targetAmount: number }[]>("/goals")).data,
    initialData: []
  });

  const exportCsv = async () => {
    const response = await apiClient.get("/reports/category-spend/export-csv", {
      params: { from, to, accountId: accountId || undefined, categoryId: categoryId || undefined, type: type || undefined },
      responseType: "blob"
    });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "category-spend.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="form-grid">
          <input className="input" placeholder="Account ID" value={accountId} onChange={(e) => setAccountId(e.target.value)} />
          <input className="input" placeholder="Category ID" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} />
          <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All Types</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
            <option value="Transfer">Transfer</option>
          </select>
          <button className="btn" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>
      <section className="two-col">
      <ChartCard title="Category Spending">
        <div style={{ height: 260 }}>
          {categorySpendQuery.isError ? (
            <p className="error">Failed chart/report fetch.</p>
          ) : categorySpendQuery.data.length === 0 ? (
            <p className="muted">No report data. Try expanding date range.</p>
          ) : (
            <ResponsiveContainer>
              <PieChart>
                <Pie data={categorySpendQuery.data} dataKey="amount" nameKey="category">
                  {categorySpendQuery.data.map((item) => (
                    <Cell key={item.category} fill={colorForCategory(item.category)} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>
      <ChartCard title="Income vs Expense Trend">
        <div style={{ height: 260 }}>
          {trendQuery.isError ? (
            <p className="error">Failed chart/report fetch.</p>
          ) : trendQuery.data.length === 0 ? (
            <p className="muted">No report data. Try expanding date range.</p>
          ) : (
            <ResponsiveContainer>
              <LineChart data={trendQuery.data}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="income" stroke="#2f68d8" strokeWidth={2} />
                <Line type="monotone" dataKey="expense" stroke="#eb5757" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>
      <ChartCard title="Account Balance Trend">
        <div style={{ height: 260 }}>
          {accountTrendQuery.isError ? (
            <p className="error">Failed chart/report fetch.</p>
          ) : accountTrendQuery.data.length === 0 ? (
            <p className="muted">No report data. Try expanding date range.</p>
          ) : (
            <ResponsiveContainer>
              <LineChart data={accountTrendQuery.data}>
                <XAxis dataKey="accountName" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="balance" stroke="#2f68d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>
      <ChartCard title="Savings Progress">
        <div style={{ height: 260 }}>
          {savingsQuery.isError ? (
            <p className="error">Failed chart/report fetch.</p>
          ) : savingsQuery.data.length === 0 ? (
            <p className="muted">No goals available.</p>
          ) : (
            <ResponsiveContainer>
              <BarChart data={savingsQuery.data}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="currentAmount" fill="#36a269" />
                <Bar dataKey="targetAmount" fill="#8ca3c2" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </ChartCard>
      </section>
    </section>
  );
}
