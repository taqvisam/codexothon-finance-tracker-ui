import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useUiStore } from "../../store/uiStore";
import { apiClient } from "../../services/apiClient";
import { Dropdown } from "../../components/Dropdown";
import { getHealthScoreToneClass } from "../../utils/healthScore";

interface HealthScoreFactor {
  name: string;
  score: number;
  description: string;
}

interface HealthScoreResponse {
  score: number;
  breakdown: HealthScoreFactor[];
  suggestions: string[];
}

interface InsightHighlight {
  title: string;
  message: string;
  severity: "success" | "warning" | "info";
  changePercent: number;
  periodLabel: string;
}

interface TrendPoint {
  month: string;
  income: number;
  expense: number;
}

interface AccountItem {
  id: string;
  name: string;
}

interface CategoryItem {
  id: string;
  name: string;
}

export function InsightsPage() {
  const { dateFrom, dateTo, topbarSearch } = useUiStore();
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const sync = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(event.matches);
    };

    sync(media);

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }

    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  const accountsQuery = useQuery({
    queryKey: ["insights-accounts"],
    queryFn: async () => (await apiClient.get<AccountItem[]>("/accounts")).data,
    initialData: []
  });
  const categoriesQuery = useQuery({
    queryKey: ["insights-categories"],
    queryFn: async () => (await apiClient.get<CategoryItem[]>("/categories")).data,
    initialData: []
  });
  const healthScoreQuery = useQuery({
    queryKey: ["insights-health-score"],
    queryFn: async () => (await apiClient.get<HealthScoreResponse>("/insights/health-score")).data
  });
  const highlightQuery = useQuery({
    queryKey: ["insight-highlights", dateFrom, dateTo, accountId, categoryId],
    queryFn: async () =>
      (
        await apiClient.get<InsightHighlight[]>("/insights", {
          params: { from: dateFrom, to: dateTo, accountId: accountId || undefined, categoryId: categoryId || undefined }
        })
      ).data,
    initialData: []
  });
  const trendQuery = useQuery({
    queryKey: ["insights-trend", dateFrom, dateTo, accountId, categoryId],
    queryFn: async () =>
      (
        await apiClient.get<{ incomeVsExpense: TrendPoint[]; savingsRateTrend: { period: string; savingsRate: number }[] }>("/reports/trends", {
          params: { from: dateFrom, to: dateTo, accountId: accountId || undefined, categoryId: categoryId || undefined }
        })
      ).data
  });

  const score = healthScoreQuery.data?.score ?? 0;
  const roundedScore = Math.round(score);
  const normalizedSearch = topbarSearch.trim().toLowerCase();
  const filteredHighlights = useMemo(() => {
    if (!normalizedSearch) {
      return highlightQuery.data;
    }

    return highlightQuery.data.filter((item) =>
      [item.title, item.message, item.severity, item.periodLabel, String(item.changePercent)]
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [highlightQuery.data, normalizedSearch]);

  const filteredBreakdown = useMemo(() => {
    const items = healthScoreQuery.data?.breakdown ?? [];
    if (!normalizedSearch) {
      return items;
    }

    return items.filter((factor) =>
      [factor.name, factor.description, String(factor.score)].some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [healthScoreQuery.data?.breakdown, normalizedSearch]);

  const filteredSuggestions = useMemo(() => {
    const items = healthScoreQuery.data?.suggestions ?? [];
    if (!normalizedSearch) {
      return items;
    }

    return items.filter((suggestion) => suggestion.toLowerCase().includes(normalizedSearch));
  }, [healthScoreQuery.data?.suggestions, normalizedSearch]);

  return (
    <section>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="form-grid">
          <Dropdown
            label="Account"
            options={[{ value: "", label: "All Accounts" }, ...accountsQuery.data.map((account) => ({ value: account.id, label: account.name }))]}
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          />
          <Dropdown
            label="Category"
            options={[{ value: "", label: "All Categories" }, ...categoriesQuery.data.map((category) => ({ value: category.id, label: category.name }))]}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          />
        </div>
      </div>
      <div className="insights-grid">
        <article className="card">
          <h4>Financial Health Score</h4>
          <div className={`big ${getHealthScoreToneClass(score)}`}>{roundedScore} / 100</div>
          <p className="muted" style={{ marginTop: 8 }}>
            Weighted from savings rate, expense stability, budget adherence, and cash buffer.
          </p>
        </article>

        <article className="card">
          <h4>Suggestions</h4>
          {filteredSuggestions.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {filteredSuggestions.map((suggestion) => (
                <li key={suggestion} className="muted" style={{ marginBottom: 6 }}>
                  {suggestion}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No suggestions available.</p>
          )}
        </article>

        <article className="card" style={{ gridColumn: "1 / -1" }}>
          <h4>Insight Highlights</h4>
          {filteredHighlights.length === 0 ? (
            <p className="muted">No highlight cards available for this period.</p>
          ) : (
            <div className="card-grid">
              {filteredHighlights.map((item) => (
                <article key={`${item.title}-${item.periodLabel}`} className="card summary-card">
                  <h4>{item.title}</h4>
                  <div className="big">{Math.round(item.changePercent)}%</div>
                  <p className="muted">{item.message}</p>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="card">
          <h4>Income vs Expense Comparison</h4>
          <div style={{ height: 240 }}>
            {trendQuery.data?.incomeVsExpense?.length ? (
              <ResponsiveContainer>
                <LineChart data={trendQuery.data.incomeVsExpense}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="income" stroke="#2f6fbe" strokeWidth={2} />
                  <Line type="monotone" dataKey="expense" stroke="#dd5757" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No comparison data available.</p>
            )}
          </div>
        </article>

        <article className="card">
          <h4>Savings Rate Comparison</h4>
          <div style={{ height: 240 }}>
            {trendQuery.data?.savingsRateTrend?.length ? (
              <ResponsiveContainer>
                <BarChart data={trendQuery.data.savingsRateTrend}>
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="savingsRate" fill="#e2a43d" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No savings trend available.</p>
            )}
          </div>
        </article>

        <article className="card" style={{ gridColumn: "1 / -1" }}>
          <h4>Score Breakdown</h4>
          {healthScoreQuery.isLoading ? (
            <p className="muted">Loading score details...</p>
          ) : filteredBreakdown.length ? (
            isMobile ? (
              <div className="dashboard-mobile-list">
                {filteredBreakdown.map((factor) => (
                  <article key={factor.name} className="dashboard-mobile-list-item">
                    <div className="dashboard-mobile-list-head">
                      <strong>{factor.name}</strong>
                      <span className={`dashboard-mobile-list-value ${getHealthScoreToneClass(factor.score)}`}>
                        {Math.round(factor.score)}
                      </span>
                    </div>
                    <div className="dashboard-mobile-list-meta">
                      <span>{factor.description}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Factor</th>
                      <th>Score</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBreakdown.map((factor) => (
                      <tr key={factor.name}>
                        <td data-label="Factor">{factor.name}</td>
                        <td data-label="Score">
                          <span className={getHealthScoreToneClass(factor.score)}>{Math.round(factor.score)}</span>
                        </td>
                        <td data-label="Description">{factor.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <p className="muted">No breakdown data available.</p>
          )}
        </article>
      </div>
    </section>
  );
}
