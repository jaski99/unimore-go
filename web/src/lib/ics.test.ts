import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildIcs, downloadIcs, escapeText, foldLine, icsFileName, type TripEvent } from './ics';

const event: TripEvent = {
  date: '2026-10-26',
  leaveAt: '07:39',
  arriveAt: '08:18',
  summary: 'Esci alle 07:39 · RV 3907 → DIEF',
  description: 'Treno RV 3907 alle 07:44 da Reggio Emilia, arrivo 08:18.\nNon in tempo reale.',
  location: 'Reggio Emilia FS',
  reminderMin: 10,
};

describe('buildIcs', () => {
  const ics = buildIcs(event, new Date('2026-10-23T10:00:00Z'));
  const lines = ics.split('\r\n');

  it('scrive un VEVENT con orari UTC dal fuso Europe/Rome (CET dopo il 25/10)', () => {
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('DTSTART:20261026T063900Z');
    expect(lines).toContain('DTEND:20261026T071800Z');
    expect(lines).toContain('DTSTAMP:20261023T100000Z');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('in ora legale usa +02:00', () => {
    const summer = buildIcs({ ...event, date: '2026-10-20' });
    expect(summer).toContain('DTSTART:20261020T053900Z');
  });

  it('aggiunge il promemoria e la descrizione con escape', () => {
    expect(lines).toContain('TRIGGER:-PT10M');
    expect(ics).toContain('LOCATION:Reggio Emilia FS');
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('DESCRIPTION:Treno RV 3907 alle 07:44 da Reggio Emilia\\, arrivo');
    expect(unfolded).toContain('arrivo 08:18.\\nNon in tempo reale.');
    expect(buildIcs({ ...event, reminderMin: 0, location: undefined })).not.toContain('VALARM');
  });

  it('un viaggio dopo mezzanotte finisce il giorno dopo', () => {
    const night = buildIcs({ ...event, leaveAt: '23:40', arriveAt: '00:20' });
    expect(night).toContain('DTSTART:20261026T224000Z');
    expect(night).toContain('DTEND:20261026T232000Z');
  });
});

describe('helpers', () => {
  it('escape secondo RFC 5545', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('piega le righe oltre 75 byte (UTF-8)', () => {
    const folded = foldLine(`SUMMARY:${'è'.repeat(60)}`);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    const encoder = new TextEncoder();
    expect(parts.every((part) => encoder.encode(part).length <= 75)).toBe(true);
    expect(parts.slice(1).every((part) => part.startsWith(' '))).toBe(true);
    expect(parts.map((part, i) => (i ? part.slice(1) : part)).join('')).toBe(
      `SUMMARY:${'è'.repeat(60)}`,
    );
  });

  it('nome del file con data e ora', () => {
    expect(icsFileName(event)).toBe('unimorego-2026-10-26-0739.ics');
  });
});

describe('downloadIcs', () => {
  afterEach(() => vi.restoreAllMocks());

  it('scarica il file con il nome giusto', () => {
    const create = vi.fn(() => 'blob:ics');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.useFakeTimers();
    downloadIcs(event);
    expect(create).toHaveBeenCalledOnce();
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('unimorego-2026-10-26-0739.ics');
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:ics');
    vi.useRealTimers();
  });
});
