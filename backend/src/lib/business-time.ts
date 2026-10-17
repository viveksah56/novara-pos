export type BusinessCalendar = { timezone: string; businessDayStart: string };
type DateParts = { year: number; month: number; day: number };

function partsAt(value: Date, timezone: string): DateParts & { hour: number; minute: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "0";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), hour: Number(get("hour")), minute: Number(get("minute")), weekday: weekdays.indexOf(get("weekday")) };
}

function localDateTimeToUtc(date: DateParts, hour: number, minute: number, timezone: string): Date {
  const desired = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  let guess = desired;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const observed = partsAt(new Date(guess), timezone);
    const observedAsUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute);
    guess += desired - observedAsUtc;
  }
  return new Date(guess);
}

function shiftDate(date: DateParts, days: number): DateParts {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function startMinutes(calendar: BusinessCalendar): number {
  const match = /^(\d{2}):(\d{2})$/.exec(calendar.businessDayStart);
  if (!match) throw new Error("Branch businessDayStart must use HH:mm format.");
  return Number(match[1]) * 60 + Number(match[2]);
}

export function businessDayStartAt(now: Date, calendar: BusinessCalendar): Date {
  const local = partsAt(now, calendar.timezone);
  const minutes = startMinutes(calendar);
  const date = local.hour * 60 + local.minute < minutes ? shiftDate(local, -1) : local;
  return localDateTimeToUtc(date, Math.floor(minutes / 60), minutes % 60, calendar.timezone);
}

export function businessWeekStartAt(now: Date, calendar: BusinessCalendar): Date {
  const dayStart = businessDayStartAt(now, calendar);
  const localBusinessDate = partsAt(dayStart, calendar.timezone);
  const daysSinceMonday = (localBusinessDate.weekday + 6) % 7;
  const monday = shiftDate(localBusinessDate, -daysSinceMonday);
  const minutes = startMinutes(calendar);
  return localDateTimeToUtc(monday, Math.floor(minutes / 60), minutes % 60, calendar.timezone);
}

export function businessDateKey(value: Date, timezone: string, businessDayStart: string): string {
  const parts = partsAt(value, timezone);
  const minutes = startMinutes({ timezone, businessDayStart });
  const date = parts.hour * 60 + parts.minute < minutes ? shiftDate(parts, -1) : parts;
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export function localBusinessDateRange(date: string, calendar: BusinessCalendar): { from: Date; to: Date } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error("Date must use YYYY-MM-DD format.");
  const parsed = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const minutes = startMinutes(calendar);
  const from = localDateTimeToUtc(parsed, Math.floor(minutes / 60), minutes % 60, calendar.timezone);
  const nextDate = shiftDate(parsed, 1);
  const next = localDateTimeToUtc(nextDate, Math.floor(minutes / 60), minutes % 60, calendar.timezone);
  return { from, to: new Date(next.getTime() - 1) };
}

export function businessWeekdayIndex(value: Date, calendar: BusinessCalendar): number {
  const local = partsAt(value, calendar.timezone);
  const minutes = startMinutes(calendar);
  const businessDate = local.hour * 60 + local.minute < minutes ? shiftDate(local, -1) : local;
  const weekday = new Date(Date.UTC(businessDate.year, businessDate.month - 1, businessDate.day)).getUTCDay();
  return (weekday + 6) % 7;
}
