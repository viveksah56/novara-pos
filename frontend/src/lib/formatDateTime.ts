const DATE_TIME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(locale: string, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options ?? {})}`;
  let formatter = DATE_TIME_FORMATTERS.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    DATE_TIME_FORMATTERS.set(key, formatter);
  }
  return formatter;
}

export function formatDateTime(value: Date | string | number, locale = "en", options?: Intl.DateTimeFormatOptions): string {
  return getDateTimeFormatter(locale, options).format(value instanceof Date ? value : new Date(value));
}

export function formatDateTimeToParts(value: Date | string | number, locale = "en", options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormatPart[] {
  return getDateTimeFormatter(locale, options).formatToParts(value instanceof Date ? value : new Date(value));
}
