const ROME_TIME_ZONE = 'Europe/Rome';
const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Display a time from the API. The contract sends Europe/Rome wall-clock
 * "HH:MM" strings, shown verbatim; ISO date-times are converted to Rome time.
 */
export function formatClock(value: string): string {
  return CLOCK_PATTERN.test(value) ? value : formatTime(value);
}

export function formatTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: ROME_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

export function toRomeIso(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offsetText = new Intl.DateTimeFormat('en', {
    timeZone: ROME_TIME_ZONE,
    timeZoneName: 'longOffset',
  })
    .formatToParts(utcGuess)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = offsetText?.match(/GMT([+-])(\d{2}):(\d{2})/);
  const offset = match ? `${match[1]}${match[2]}:${match[3]}` : '+01:00';
  return `${date}T${time}:00${offset}`;
}

export function getNextDateForWeekday(weekday: number, from = new Date()): string {
  const local = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const daysAhead = (weekday - local.getDay() + 7) % 7 || 7;
  local.setDate(local.getDate() + daysAhead);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
}

/** Calendar parts of `now` as seen in Europe/Rome (independent of the device zone). */
function romeParts(now: Date): { date: string; time: string; weekday: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: ROME_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: weekdays.indexOf(parts.weekday),
  };
}

/** Today's date (YYYY-MM-DD) in Europe/Rome. */
export function todayInRome(now = new Date()): string {
  return romeParts(now).date;
}

/** Current wall-clock time (HH:MM) and weekday (0 = Sunday) in Europe/Rome. */
export function nowInRome(now = new Date()): { date: string; time: string; weekday: number } {
  return romeParts(now);
}

/** Add `days` to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

/** Weekday (0 = Sunday) of a YYYY-MM-DD date. */
export function weekdayOf(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

const SHORT_DATE = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * The one date format of the UI, "lun 26 ott 2026", for a YYYY-MM-DD string.
 * The API writes the same text (engine/validity.py format_it_day), so dates
 * in notices and in the interface read alike.
 */
export function formatShortDate(date: string): string {
  return SHORT_DATE.format(new Date(`${date}T12:00:00Z`));
}

/** "45 min", "1 h", "2 h 05 min" */
export function formatDuration(minutes: number): string {
  const total = Math.abs(Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${String(rest).padStart(2, '0')} min` : `${hours} h`;
}

/** True when the YYYY-MM-DD date is today in Europe/Rome. */
export function isToday(date: string, now = new Date()): boolean {
  return date === todayInRome(now);
}

/** Add minutes to "HH:MM", clamped to the same day (00:00-23:55 by default). */
export function addMinutesClamped(time: string, minutes: number, max = '23:55'): string {
  const [hour, minute] = time.split(':').map(Number);
  const [maxHour, maxMinute] = max.split(':').map(Number);
  const total = Math.max(0, Math.min(hour * 60 + minute + minutes, maxHour * 60 + maxMinute));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
