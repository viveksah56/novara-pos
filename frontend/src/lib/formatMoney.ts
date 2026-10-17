const NUMBER_FORMATTERS = new Map<string, Intl.NumberFormat>();

export function formatMoney(
  value: number | string | null | undefined,
  currency = "NPR",
  maximumFractionDigits = 0,
): string {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  const key = `${currency}:${maximumFractionDigits}`;
  let formatter = NUMBER_FORMATTERS.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency,
      maximumFractionDigits,
    });
    NUMBER_FORMATTERS.set(key, formatter);
  }
  return formatter.format(Number.isFinite(amount) ? amount : 0);
}
