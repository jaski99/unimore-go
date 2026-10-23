import { describe, expect, it } from 'vitest';
import { defaultPlannerValues, type PlannerValues } from '@/lib/plan-request';
import { isCompleteSearch, parseSearch, serializeSearch } from './url-state';

const values: PlannerValues = {
  ...defaultPlannerValues(new Date('2026-10-23T10:00:00Z')),
  campusId: 'palazzo_dossetti',
  stationId: 'modena_fs',
  date: '2026-10-25',
  time: '09:00',
  mode: 'walk',
};

describe('serializeSearch / parseSearch', () => {
  it('scrive sede, stazione, data, ora, mezzo e verso con nomi leggibili', () => {
    expect(serializeSearch(values)).toBe(
      'sede=palazzo_dossetti&stazione=modena_fs&data=2026-10-25&ora=09%3A00&mezzo=piedi&verso=andata',
    );
  });

  it('andata e ritorno: il link conserva anche la fine della lezione', () => {
    const search = parseSearch(`?${serializeSearch(values, '13:00')}`);
    expect(search.returnTime).toBe('13:00');
    expect(search.patch).toEqual({
      campusId: 'palazzo_dossetti',
      stationId: 'modena_fs',
      originKind: 'station',
      date: '2026-10-25',
      time: '09:00',
      mode: 'walk',
      direction: 'outbound',
    });
    expect(isCompleteSearch(search)).toBe(true);
  });

  it('non mette mai la posizione di casa nel link', () => {
    const fromHome: PlannerValues = {
      ...values,
      originKind: 'home',
      home: { label: 'Casa mia, Via Roma 1', lat: 44.65, lon: 10.92 },
    };
    const query = serializeSearch(fromHome);
    expect(query).not.toContain('stazione');
    expect(query).toContain('partenza=casa');
    expect(query).not.toMatch(/44\.65|10\.92|Roma/);
    const parsed = parseSearch(query).patch;
    expect(parsed.originKind).toBe('home');
    expect(parsed.home).toBeUndefined();
  });

  it('il ritorno come direzione principale non porta il parametro ritorno', () => {
    const query = serializeSearch({ ...values, direction: 'return' }, '13:00');
    expect(query).toContain('verso=ritorno');
    expect(query).not.toContain('ritorno=13');
  });

  it('ignora i parametri non validi uno per uno', () => {
    const search = parseSearch(
      'sede=DIEF!&stazione=reggio_fs&data=2026-02-30&ora=25:00&mezzo=auto&verso=su&ritorno=7',
    );
    expect(search.patch).toEqual({ stationId: 'reggio_fs', originKind: 'station' });
    expect(search.returnTime).toBeUndefined();
    expect(isCompleteSearch(search)).toBe(false);
    expect(parseSearch('').patch).toEqual({});
  });
});
