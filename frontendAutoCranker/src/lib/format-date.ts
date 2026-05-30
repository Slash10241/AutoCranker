// Locale-independent date formatters so SSR and client always render the same string.
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const pad = (n: number) => n.toString().padStart(2, "0");

/** UI dates (calendar) — always English regardless of browser locale. */
export const DISPLAY_LOCALE = "en-US";

/** Demo calendar opens on June (May 31 appears on the first row). */
export function defaultCalendarMonth(): Date {
  return new Date(2026, 5, 1);
}

export function defaultCalendarSelectedDate(): string {
  return "2026-05-31";
}

export function formatMonthYear(d: Date): string {
  return d.toLocaleString(DISPLAY_LOCALE, { month: "long", year: "numeric" });
}

export function formatWeekdayShortDate(d: Date): string {
  return d.toLocaleDateString(DISPLAY_LOCALE, { weekday: "short", month: "short", day: "numeric" });
}

export function formatWeekdayLongDate(d: Date): string {
  return d.toLocaleDateString(DISPLAY_LOCALE, { weekday: "long", month: "short", day: "numeric" });
}

export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatTimeUTC(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function formatDateUTC(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatDateTimeUTC(iso: string): string {
  return `${formatDateUTC(iso)} · ${formatTimeUTC(iso)}`;
}

export function formatDayLabelUTC(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setUTCDate(today.getUTCDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate();
  if (same(d, today)) return "Today";
  if (same(d, yesterday)) return "Yesterday";
  return formatDateUTC(iso);
}

export function utcDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
