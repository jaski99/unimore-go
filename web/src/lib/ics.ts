import { toRomeIso } from '@/lib/time-format';

/**
 * Minimal RFC 5545 calendar file for "Esci alle HH:MM", generated in the
 * browser (no server, no account). Times are written in UTC from the
 * Europe/Rome wall-clock times of the itinerary.
 */
export interface TripEvent {
  /** Travel date YYYY-MM-DD. */
  date: string;
  /** Leave time HH:MM (event start). */
  leaveAt: string;
  /** Arrival time HH:MM (event end; earlier than leaveAt = next day). */
  arriveAt: string;
  summary: string;
  description: string;
  location?: string;
  /** Minutes before leaving for the reminder (0 = none). */
  reminderMin?: number;
}

const pad = (value: number) => String(value).padStart(2, '0');

function utcStamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function romeToUtc(date: string, time: string): Date {
  return new Date(toRomeIso(date, time));
}

/** RFC 5545 TEXT escaping. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Fold lines longer than 75 octets (UTF-8) with CRLF + space. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  for (const char of line) {
    const limit = parts.length ? 74 : 75; // continuation lines start with a space
    if (encoder.encode(current + char).length > limit) {
      parts.push(current);
      current = char;
    } else current += char;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function buildIcs(event: TripEvent, now = new Date()): string {
  const start = romeToUtc(event.date, event.leaveAt);
  let end = romeToUtc(event.date, event.arriveAt);
  if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  const uid = `${utcStamp(start)}-${event.leaveAt.replace(':', '')}@unimorego`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UnimoreGo//Commuter planner//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    ...(event.reminderMin
      ? [
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          `DESCRIPTION:${escapeText(event.summary)}`,
          `TRIGGER:-PT${event.reminderMin}M`,
          'END:VALARM',
        ]
      : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

/** "unimorego-2026-10-26-0739.ics" */
export function icsFileName(event: Pick<TripEvent, 'date' | 'leaveAt'>): string {
  return `unimorego-${event.date}-${event.leaveAt.replace(':', '')}.ics`;
}

/** Trigger a download of the calendar file (browser only). */
export function downloadIcs(event: TripEvent): void {
  const blob = new Blob([buildIcs(event)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = icsFileName(event);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
