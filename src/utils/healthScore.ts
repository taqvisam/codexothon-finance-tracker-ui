export function getHealthScoreToneClass(score: number): string {
  if (score >= 80) {
    return "health-score-good";
  }

  if (score >= 55) {
    return "health-score-warn";
  }

  return "health-score-danger";
}
