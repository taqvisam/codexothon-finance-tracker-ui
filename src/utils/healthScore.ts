export function getHealthScoreToneClass(score: number): string {
  if (score >= 80) {
    return "health-score-good";
  }

  if (score >= 55) {
    return "health-score-warn";
  }

  return "health-score-danger";
}

export function getHealthScoreColor(score: number): string {
  if (score >= 80) {
    return "#2ea05f";
  }

  if (score >= 55) {
    return "#d78a1f";
  }

  return "#d74d57";
}
