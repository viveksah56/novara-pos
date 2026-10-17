export function formatMoney(
  value: number | string | null | undefined,
  currency = "NPR",
  maximumFractionDigits = 0,
): string {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(Number.isFinite(amount) ? amount : 0);
}
