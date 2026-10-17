import { formatDateTimeToParts } from "@/lib/formatDateTime";

export function dateKey(date: Date, timeZone?: string) {
  const parts = formatDateTimeToParts(date, "en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}
