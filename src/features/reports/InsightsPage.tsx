import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useUiStore } from "../../store/uiStore";
import { apiClient } from "../../services/apiClient";
import { Dropdown } from "../../components/Dropdown";
import { getHealthScoreColor, getHealthScoreToneClass } from "../../utils/healthScore";

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

function getHealthScoreLabel(score: number) {
  if (score >= 80) {
    return "Excellent";
  }

  if (score >= 55) {
    return "Stable";
  }

  return "At Risk";
}

function getHighlightToneClass(severity: InsightHighlight["severity"]) {
  switch (severity) {
    case "success":
      return "insight-highlight-success";
    case "warning":
      return "insight-highlight-warning";
    default:
      return "insight-highlight-info";
  }
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

  const incomeExpenseTrend = trendQuery.data?.incomeVsExpense ?? [];
  const savingsRateTrend = trendQuery.data?.savingsRateTrend ?? [];

  const latestIncomeExpense = useMemo(() => {
    if (!incomeExpenseTrend.length) {
      return null;
    }

    const latest = incomeExpenseTrend[incomeExpenseTrend.length - 1];
    const previous = incomeExpenseTrend.length > 1 ? incomeExpenseTrend[incomeExpenseTrend.length - 2] : null;
    const net = latest.income - latest.expense;
    const previousNet = previous ? previous.income - previous.expense : 0;

    return {
      latest,
      net,
      netDelta: net - previousNet
    };
  }, [incomeExpenseTrend]);

  const latestSavingsRate = useMemo(() => {
    if (!savingsRateTrend.length) {
      return null;
    }

    const latest = savingsRateTrend[savingsRateTrend.length - 1];
    const previous = savingsRateTrend.length > 1 ? savingsRateTrend[savingsRateTrend.length - 2] : null;
    const latestRate = latest.savingsRate;
    const delta = previous ? latestRate - previous.savingsRate : 0;

    return {
      period: latest.period,
      rate: latestRate,
      delta,
      previousRate: previous?.savingsRate ?? 0
    };
  }, [savingsRateTrend]);

  const savingsGaugeValue = Math.max(0, Math.min(100, latestSavingsRate?.rate ?? 0));
  const savingsGaugeColor = getHealthScoreColor(savingsGaugeValue);
  const scoreAccent = getHealthScoreColor(score);
  const scoreLabel = getHealthScoreLabel(score);

  return (
    <section className="insights-page">
      <div className="card insights-filter-card insights-filter-shell">
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

      <div className="insights-top-grid">
        <article className="card insights-score-card insights-hero-card">
          <div className="insights-hero-copy">
            <span className="insights-section-kicker">Finance signal</span>
            <h4>Financial Health Score</h4>
            <div className="insights-hero-status-row">
              <span className={`insights-hero-status ${getHealthScoreToneClass(score)}`}>{scoreLabel}</span>
              <span className="muted">Weighted from savings rate, expense stability, budget adherence, and cash buffer.</span>
            </div>
            <div className="insights-factor-strip">
              {(healthScoreQuery.data?.breakdown ?? []).slice(0, 4).map((factor) => (
                <div key={factor.name} className="insights-factor-pill">
                  <span>{factor.name}</span>
                  <strong className={getHealthScoreToneClass(factor.score)}>{Math.round(factor.score)}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="insights-score-orbit" style={{ ["--score-accent" as string]: scoreAccent, ["--score-angle" as string]: `${Math.max(8, Math.min(360, Math.round(score * 3.6)))}deg` }}>
            <div className="insights-score-orbit-core">
              <strong className={getHealthScoreToneClass(score)}>{roundedScore}</strong>
              <span>/ 100</span>
            </div>
          </div>
        </article>

        <article className="card insights-suggestions-card insights-action-card">
          <div className="insights-card-headline">
            <span className="insights-section-kicker">Action queue</span>
            <h4>Suggestions</h4>
          </div>
          {filteredSuggestions.length ? (
            <div className="insights-action-shell">
              <ul className="insights-suggestion-list">
              {filteredSuggestions.map((suggestion, index) => (
                <li key={suggestion}>
                  <span className="insights-suggestion-index" aria-hidden="true">{index + 1}</span>
                  <span>{suggestion}</span>
                </li>
              ))}
              </ul>
            </div>
          ) : (
            <p className="muted">No suggestions available.</p>
          )}
        </article>
      </div>

      <article className="card insights-highlights-card">
        <div className="insights-card-headline">
          <span className="insights-section-kicker">Pattern watch</span>
          <h4>Insight Highlights</h4>
        </div>
        {filteredHighlights.length === 0 ? (
          <p className="muted">No highlight cards available for this period.</p>
        ) : (
          <div className="card-grid insights-highlight-grid">
            {filteredHighlights.map((item) => (
              <article key={`${item.title}-${item.periodLabel}`} className={`card summary-card insight-highlight-card ${getHighlightToneClass(item.severity)}`}>
                <div className="insight-highlight-head">
                  <span className="insight-highlight-period">{item.periodLabel}</span>
                  <span className={`insight-highlight-change ${item.severity === "success" ? "health-score-good" : item.severity === "warning" ? "health-score-warn" : ""}`}>
                    {item.severity === "success" ? "Positive" : item.severity === "warning" ? "Watch" : "Signal"}
                  </span>
                </div>
                <div className="insight-highlight-body">
                  <div className="insight-highlight-copy">
                    <h4>{item.title}</h4>
                    <p className="muted">{item.message}</p>
                  </div>
                  <div className="insight-highlight-metric">
                    <strong className={item.severity === "success" ? "health-score-good" : item.severity === "warning" ? "health-score-warn" : ""}>
                      {Math.round(item.changePercent)}%
                    </strong>
                    <span>vs previous period</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </article>

      <div className="insights-chart-grid">
        <article className="card insights-chart-card insights-chart-card-wide">
          <div className="insights-chart-head">
            <div>
              <span className="insights-section-kicker">Cash movement</span>
              <h4>Income vs Expense Flow</h4>
              <p className="muted">Use the full period to compare earnings, outflow, and net momentum.</p>
            </div>
            {latestIncomeExpense ? (
              <div className="insights-chart-kpis">
                <div className="insights-chart-kpi">
                  <span className="muted">Latest net</span>
                  <strong className={latestIncomeExpense.net >= 0 ? "health-score-good" : "health-score-danger"}>
                    {Math.round(latestIncomeExpense.net)}
                  </strong>
                </div>
                <div className="insights-chart-kpi">
                  <span className="muted">Net shift</span>
                  <strong className={latestIncomeExpense.netDelta >= 0 ? "health-score-good" : "health-score-danger"}>
                    {latestIncomeExpense.netDelta >= 0 ? "+" : ""}
                    {Math.round(latestIncomeExpense.netDelta)}
                  </strong>
                </div>
              </div>
            ) : null}
          </div>

          <div className="insights-area-chart">
            {incomeExpenseTrend.length ? (
              <ResponsiveContainer>
                <AreaChart data={incomeExpenseTrend} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#39b86b" stopOpacity={0.36} />
                      <stop offset="100%" stopColor="#39b86b" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e16672" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#e16672" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(112, 138, 176, 0.18)" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={42} />
                  <Tooltip />
                  <Area type="monotone" dataKey="income" stroke="#2ea05f" fill="url(#incomeFill)" strokeWidth={3} />
                  <Area type="monotone" dataKey="expense" stroke="#d74d57" fill="url(#expenseFill)" strokeWidth={3} />
                  <Line type="monotone" dataKey={(point: TrendPoint) => point.income - point.expense} stroke="#2f6fbe" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">No comparison data available.</p>
            )}
          </div>

          <div className="insights-chart-legend">
            <span><i className="insights-legend-dot income" /> Income</span>
            <span><i className="insights-legend-dot expense" /> Expense</span>
            <span><i className="insights-legend-dot net" /> Net</span>
          </div>
        </article>

        <article className="card insights-chart-card insights-chart-card-compact">
          <div className="insights-chart-head compact">
            <div>
              <span className="insights-section-kicker">Reserve strength</span>
              <h4>Savings Rate Pulse</h4>
              <p className="muted">Latest savings performance with recent-period context.</p>
            </div>
          </div>

          <div className="insights-savings-gauge-wrap">
            {latestSavingsRate ? (
              <>
                <div className="insights-savings-gauge">
                  <ResponsiveContainer>
                    <RadialBarChart
                      data={[{ name: "Savings Rate", value: savingsGaugeValue, fill: savingsGaugeColor }]}
                      innerRadius="68%"
                      outerRadius="100%"
                      startAngle={205}
                      endAngle={-25}
                      barSize={18}
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar background dataKey="value" cornerRadius={999} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="insights-savings-gauge-center">
                    <strong className={getHealthScoreToneClass(latestSavingsRate.rate)}>{Math.round(latestSavingsRate.rate)}%</strong>
                    <span>{latestSavingsRate.period}</span>
                  </div>
                </div>

                <div className="insights-savings-stats">
                  <div className="insights-savings-stat">
                    <span className="muted">Previous</span>
                    <strong>{Math.round(latestSavingsRate.previousRate)}%</strong>
                  </div>
                  <div className="insights-savings-stat">
                    <span className="muted">Change</span>
                    <strong className={latestSavingsRate.delta >= 0 ? "health-score-good" : "health-score-danger"}>
                      {latestSavingsRate.delta >= 0 ? "+" : ""}
                      {Math.round(latestSavingsRate.delta)} pts
                    </strong>
                  </div>
                </div>

                <div className="insights-mini-bars">
                  {savingsRateTrend.slice(-5).map((point) => (
                    <div key={point.period} className="insights-mini-bar-item">
                      <span
                        className="insights-mini-bar"
                        style={{
                          height: `${Math.max(16, Math.min(100, point.savingsRate))}%`,
                          background: getHealthScoreColor(point.savingsRate)
                        }}
                      />
                      <small>{point.period}</small>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="muted">No savings trend available.</p>
            )}
          </div>
        </article>
      </div>

      <article className="card insights-breakdown-card">
        <div className="insights-card-headline">
          <span className="insights-section-kicker">Signal decomposition</span>
          <h4>Score Breakdown</h4>
        </div>
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
    </section>
  );
}
