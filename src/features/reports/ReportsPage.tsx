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
import { useMemo, useState } from "react";
import { ChartCard } from "../../components/ChartCard";
import { apiClient } from "../../services/apiClient";
import { useUiStore } from "../../store/uiStore";
import { Dropdown } from "../../components/Dropdown";

interface AccountItem {
  id: string;
  name: string;
}

interface CategoryItem {
  id: string;
  name: string;
}

interface TrendPoint {
  month: string;
  income: number;
  expense: number;
}

interface ReportTrendsResponse {
  categoryTrends: { period: string; category: string; amount: number }[];
  savingsRateTrend: { period: string; savingsRate: number }[];
  incomeVsExpense: TrendPoint[];
}

const piePalette = ["#2f6fbe", "#36a269", "#ee9a2f", "#dd5757", "#1e8caa", "#6f7c91"];

function colorForCategory(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return piePalette[hash % piePalette.length];
}

export function ReportsPage() {
  const { dateFrom: from, dateTo: to, setDateRange, topbarSearch } = useUiStore();
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState("");
  const accountsQuery = useQuery({
    queryKey: ["report-accounts"],
    queryFn: async () => (await apiClient.get<AccountItem[]>("/accounts")).data,
    initialData: []
  });
  const categoriesQuery = useQuery({
    queryKey: ["report-categories"],
    queryFn: async () => (await apiClient.get<CategoryItem[]>("/categories")).data,
    initialData: []
  });
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
    queryKey: ["report-trends-v2", from, to, accountId, categoryId],
    queryFn: async () =>
      (
        await apiClient.get<ReportTrendsResponse>("/reports/trends", {
          params: { from, to, accountId: accountId || undefined, categoryId: categoryId || undefined }
        })
      ).data
  });
  const netWorthQuery = useQuery({
    queryKey: ["report-net-worth", from, to, accountId],
    queryFn: async () =>
      (
        await apiClient.get<{ period: string; netWorth: number }[]>("/reports/net-worth", {
          params: { from, to, accountId: accountId || undefined }
        })
      ).data,
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

  const normalizedSearch = topbarSearch.trim().toLowerCase();
  const filteredCategorySpend = useMemo(() => {
    if (!normalizedSearch) {
      return categorySpendQuery.data;
    }

    return categorySpendQuery.data.filter((item) => item.category.toLowerCase().includes(normalizedSearch));
  }, [categorySpendQuery.data, normalizedSearch]);

  const filteredCategoryTrends = useMemo(() => {
    const items = trendQuery.data?.categoryTrends ?? [];
    if (!normalizedSearch) {
      return items;
    }

    return items.filter((item) =>
      [item.category, item.period, String(item.amount)].some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [normalizedSearch, trendQuery.data?.categoryTrends]);

  return (
    <section>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="form-grid">
          <label style={{ display: "block" }}>
            <span className="muted" style={{ display: "block", marginBottom: 4 }}>From Date</span>
            <input className="input" type="date" value={from} onChange={(e) => setDateRange(e.target.value, to)} />
          </label>
          <label style={{ display: "block" }}>
            <span className="muted" style={{ display: "block", marginBottom: 4 }}>To Date</span>
            <input className="input" type="date" value={to} onChange={(e) => setDateRange(from, e.target.value)} />
          </label>
          <Dropdown
            label="Account"
            options={[{ value: "", label: "All Accounts" }, ...accountsQuery.data.map((a) => ({ value: a.id, label: a.name }))]}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          />
          <Dropdown
            label="Category"
            options={[{ value: "", label: "All Categories" }, ...categoriesQuery.data.map((c) => ({ value: c.id, label: c.name }))]}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          />
          <Dropdown
            label="Type"
            options={[
              { value: "", label: "All Types" },
              { value: "Income", label: "Income" },
              { value: "Expense", label: "Expense" },
              { value: "Transfer", label: "Transfer" }
            ]}
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
          <button className="btn" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <section className="two-col">
        <ChartCard title="Category Spending">
          <div style={{ height: 260 }}>
            {filteredCategorySpend.length === 0 ? (
              <p className="muted">No report data. Try expanding date range.</p>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={filteredCategorySpend} dataKey="amount" nameKey="category">
                    {filteredCategorySpend.map((item) => (
                      <Cell key={item.category} fill={colorForCategory(item.category)} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Income vs Expense Over Months">
          <div style={{ height: 260 }}>
            {trendQuery.data?.incomeVsExpense?.length ? (
              <ResponsiveContainer>
                <LineChart data={trendQuery.data.incomeVsExpense}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="income" stroke="#2f68d8" strokeWidth={2} />
                  <Line type="monotone" dataKey="expense" stroke="#eb5757" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No comparison data available.</p>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Category Trends Over Time">
          <div style={{ height: 260 }}>
            {filteredCategoryTrends.length ? (
              <ResponsiveContainer>
                <BarChart data={filteredCategoryTrends}>
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#36a269" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No category trend data available.</p>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Savings Rate Trend">
          <div style={{ height: 260 }}>
            {trendQuery.data?.savingsRateTrend?.length ? (
              <ResponsiveContainer>
                <LineChart data={trendQuery.data.savingsRateTrend}>
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="savingsRate" stroke="#e2a43d" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No savings rate trend available.</p>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Net Worth Tracking">
          <div style={{ height: 260 }}>
            {netWorthQuery.data.length ? (
              <ResponsiveContainer>
                <LineChart data={netWorthQuery.data}>
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="netWorth" stroke="#1e8caa" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No net worth data available.</p>
            )}
          </div>
        </ChartCard>
      </section>
    </section>
  );
}
