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

export function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: ROME_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
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
