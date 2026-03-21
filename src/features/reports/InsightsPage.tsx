import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";

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

export function InsightsPage() {
  const healthScoreQuery = useQuery({
    queryKey: ["insights-health-score"],
    queryFn: async () => (await apiClient.get<HealthScoreResponse>("/insights/health-score")).data
  });

  const score = healthScoreQuery.data?.score ?? 0;

  return (
    <section className="two-col">
      <article className="card">
        <h4>Financial Health Score</h4>
        <div className="big">{Math.round(score)} / 100</div>
        <p className="muted" style={{ marginTop: 8 }}>
          Weighted from savings rate, expense stability, budget adherence, and cash buffer.
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

