import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";
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

interface TrendItem {
  month: string;
  income: number;
  expense: number;
}

interface ForecastMonth {
  safeToSpend: number;
  forecastedEndBalance: number;
}

export function InsightsPage() {
  const { dateFrom, dateTo } = useUiStore();
  const healthScoreQuery = useQuery({
    queryKey: ["insights-health-score"],
    queryFn: async () => (await apiClient.get<HealthScoreResponse>("/insights/health-score")).data
  });
  const trendQuery = useQuery({
    queryKey: ["insights-trend", dateFrom, dateTo],
    queryFn: async () =>
      (
        await apiClient.get<TrendItem[]>("/reports/income-vs-expense", {
          params: { from: dateFrom, to: dateTo }
        })
      ).data,
    initialData: []
  });
  const forecastQuery = useQuery({
    queryKey: ["insights-forecast"],
    queryFn: async () => (await apiClient.get<ForecastMonth>("/forecast/month")).data
  });

  const score = healthScoreQuery.data?.score ?? 0;
  const lastPoint = trendQuery.data.at(-1);
  const savings = (lastPoint?.income ?? 0) - (lastPoint?.expense ?? 0);

  return (
    <section className="insights-grid">
      <article className="card">
        <h4>Financial Health Score</h4>
        <div className="big">{Math.round(score)} / 100</div>
        <p className="muted" style={{ marginTop: 8 }}>
          Weighted from savings rate, expense stability, budget adherence, and cash buffer.
        </p>
      </article>

      <article className="card">
        <h4>Projected Balance</h4>
        <div className="big">{Math.round(forecastQuery.data?.forecastedEndBalance ?? 0)}</div>
        <p className="muted" style={{ marginTop: 8 }}>
          Safe to spend this month: {Math.round(forecastQuery.data?.safeToSpend ?? 0)}
        </p>
      </article>

      <article className="card">
        <h4>Latest Savings Delta</h4>
        <div className="big">{Math.round(savings)}</div>
        <p className="muted" style={{ marginTop: 8 }}>
          Based on latest income vs expense trend point.
        </p>
      </article>

      <article className="card">
        <h4>Suggestions</h4>
        {healthScoreQuery.data?.suggestions?.length ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {healthScoreQuery.data.suggestions.map((suggestion) => (
              <li key={suggestion} className="muted" style={{ marginBottom: 6 }}>
                {suggestion}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No suggestions available.</p>
        )}
      </article>

      <article className="card">
        <h4>Income vs Expense Analytics</h4>
        <div style={{ height: 240 }}>
          {trendQuery.data.length === 0 ? (
            <p className="muted">No trend data available.</p>
          ) : (
            <ResponsiveContainer>
              <LineChart data={trendQuery.data}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="income" stroke="#2f6fbe" strokeWidth={2} />
                <Line type="monotone" dataKey="expense" stroke="#dd5757" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>

      <article className="card">
        <h4>Monthly Comparison</h4>
        <div style={{ height: 240 }}>
          {trendQuery.data.length === 0 ? (
            <p className="muted">No comparison data available.</p>
          ) : (
            <ResponsiveContainer>
              <BarChart data={trendQuery.data}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="income" fill="#2f6fbe" />
                <Bar dataKey="expense" fill="#edaa4c" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>

      <article className="card" style={{ gridColumn: "1 / -1" }}>
        <h4>Score Breakdown</h4>
        {healthScoreQuery.isLoading ? (
          <p className="muted">Loading score details...</p>
        ) : healthScoreQuery.data?.breakdown?.length ? (
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
                {healthScoreQuery.data.breakdown.map((factor) => (
                  <tr key={factor.name}>
                    <td data-label="Factor">{factor.name}</td>
                    <td data-label="Score">{Math.round(factor.score)}</td>
                    <td data-label="Description">{factor.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No breakdown data available.</p>
        )}
      </article>
    </section>
  );
}
