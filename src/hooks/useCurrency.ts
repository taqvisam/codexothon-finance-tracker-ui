import { useMemo } from "react";

const regionCurrencyMap: Record<string, string> = {
  US: "USD",
  IN: "INR",
  GB: "GBP",
  CA: "CAD",
  AU: "AUD",
  NZ: "NZD",
  SG: "SGD",
  JP: "JPY",
  CN: "CNY",
  HK: "HKD",
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  KW: "KWD",
  OM: "OMR",
  BH: "BHD",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  CZ: "CZK",
  HU: "HUF",
  RO: "RON",
  BG: "BGN",
  TR: "TRY",
  RU: "RUB",
  ZA: "ZAR",
  BR: "BRL",
  MX: "MXN",
  AR: "ARS",
  CL: "CLP",
  CO: "COP",
  PE: "PEN",
  KR: "KRW",
  TH: "THB",
  VN: "VND",
  ID: "IDR",
  MY: "MYR",
  PH: "PHP",
  PK: "PKR",
  BD: "BDT",
  LK: "LKR",
  NG: "NGN",
  EG: "EGP",
  IL: "ILS",
  MA: "MAD",
  TN: "TND",
  ET: "ETB",
  GH: "GHS"
};

function getBrowserLocale(): string {
  if (typeof navigator === "undefined") return "en-US";
  return navigator.languages?.[0] ?? navigator.language ?? "en-US";
}

function getRegionFromLocale(locale: string): string | null {
  try {
    // Intl.Locale gives region reliably for modern browsers.
    const localeObj = new Intl.Locale(locale);
    if (localeObj.region) return localeObj.region.toUpperCase();
  } catch {
    // Ignore and fallback below.
  }

  const parts = locale.split("-");
  if (parts.length > 1) return parts[parts.length - 1].toUpperCase();
  return null;
}

function getCurrencyForLocale(locale: string): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzCurrency = getCurrencyFromTimeZone(timeZone);
  if (tzCurrency) return tzCurrency;

  const region = getRegionFromLocale(locale);
  if (region && regionCurrencyMap[region]) return regionCurrencyMap[region];

  // Common default for many locales in Europe.
  if (locale.startsWith("de") || locale.startsWith("fr") || locale.startsWith("es") || locale.startsWith("it") || locale.startsWith("nl") || locale.startsWith("pt")) {
    return "EUR";
  }

  return "USD";
}

function getCurrencyFromTimeZone(timeZone?: string): string | null {
  if (!timeZone) return null;

  const directMap: Record<string, string> = {
    "Asia/Kolkata": "INR",
    "Asia/Calcutta": "INR",
    "Asia/Dubai": "AED",
    "Asia/Singapore": "SGD",
    "Asia/Tokyo": "JPY",
    "Asia/Seoul": "KRW",
    "Europe/London": "GBP",
    "Europe/Paris": "EUR",
    "Europe/Berlin": "EUR",
    "America/New_York": "USD",
    "America/Chicago": "USD",
    "America/Denver": "USD",
    "America/Los_Angeles": "USD",
    "Australia/Sydney": "AUD"
  };

  if (directMap[timeZone]) return directMap[timeZone];

  if (timeZone.startsWith("Asia/Kolkata") || timeZone.startsWith("Asia/Calcutta")) {
    return "INR";
  }

  return null;
}

export function useCurrency() {
  const locale = useMemo(() => getBrowserLocale(), []);
  const currency = useMemo(() => getCurrencyForLocale(locale), [locale]);
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency
      }),
    [currency, locale]
  );

  return (value: number) => formatter.format(value);
}
