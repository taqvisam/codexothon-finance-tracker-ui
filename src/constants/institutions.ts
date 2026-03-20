export const CUSTOM_INSTITUTION_VALUE = "__custom__";

export const INSTITUTION_OPTIONS = [
  "State Bank of India",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Punjab National Bank",
  "Bank of Baroda",
  "Canara Bank",
  "Union Bank of India",
  "IDBI Bank"
];

export function resolveInstitutionName(selected: string, customInput: string): string {
  if (selected === CUSTOM_INSTITUTION_VALUE) {
    return customInput.trim();
  }

  return selected.trim();
}

export function splitInstitutionName(institutionName?: string | null): {
  selectedInstitution: string;
  customInstitution: string;
} {
  if (!institutionName) {
    return {
      selectedInstitution: "",
      customInstitution: ""
    };
  }

  const trimmed = institutionName.trim();
  if (INSTITUTION_OPTIONS.includes(trimmed)) {
    return {
      selectedInstitution: trimmed,
      customInstitution: ""
    };
  }

  return {
    selectedInstitution: CUSTOM_INSTITUTION_VALUE,
    customInstitution: trimmed
  };
}
