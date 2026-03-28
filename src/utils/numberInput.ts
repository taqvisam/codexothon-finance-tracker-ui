export function parseLooseNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function requiredLooseNumber(message: string) {
  return {
    setValueAs: parseLooseNumber,
    validate: (value: unknown) => isFiniteNumber(value) || message
  };
}

export function optionalLooseNumber(message: string) {
  return {
    setValueAs: parseLooseNumber,
    validate: (value: unknown) => value === undefined || isFiniteNumber(value) || message
  };
}
