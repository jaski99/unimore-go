import { describe, expect, it } from 'vitest';
import { memoryStorage } from '@/test/memory-storage';
import { defaultPlannerValues } from './plan-request';
import { LocalStoragePreferencesStore, sanitizePreferences } from './preferences-store';

const base = defaultPlannerValues(new Date('2026-10-26T06:00:00Z'));

describe('LocalStoragePreferencesStore', () => {
  it('salva tutto tranne la data e lo ricarica', () => {
    const storage = memoryStorage();
    const store = new LocalStoragePreferencesStore(storage);
    expect(store.load(base)).toBeNull();
    store.save({
      ...base,
      mode: 'walk',
      stationBufferMin: 8,
      regionalOnly: false,
      originKind: 'home',
      home: { label: 'Via Emilia 1', lat: 44.7, lon: 10.63 },
    });
    expect(JSON.parse(storage.data['unimorego.planner.v1'])).not.toHaveProperty('date');
    expect(store.load(base)).toMatchObject({
      mode: 'walk',
      stationBufferMin: 8,
      regionalOnly: false,
      originKind: 'home',
      home: { label: 'Via Emilia 1', lat: 44.7, lon: 10.63 },
    });
    store.clear();
    expect(store.load(base)).toBeNull();
  });

  it('ignora JSON corrotto e storage non scrivibile', () => {
    const broken = memoryStorage({ 'unimorego.planner.v1': '{not json' });
    expect(new LocalStoragePreferencesStore(broken).load(base)).toBeNull();
    const full = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() => new LocalStoragePreferencesStore(full).save(base)).not.toThrow();
  });
});

describe('sanitizePreferences', () => {
  it('ricade sui valori predefiniti campo per campo', () => {
    const result = sanitizePreferences(
      {
        direction: 'sideways',
        mode: 'car',
        marginMin: 500,
        stationBufferMin: 0,
        regionalOnly: 'yes',
        time: '8:30',
        homeToStationMin: -3,
        home: { lat: 200, lon: 10 },
        campusId: 'economia_biagi',
      },
      base,
    );
    expect(result).toMatchObject({
      direction: 'outbound',
      mode: 'bike',
      marginMin: 60,
      stationBufferMin: 1,
      regionalOnly: true,
      time: '08:30',
      homeToStationMin: null,
      home: null,
      campusId: 'economia_biagi',
    });
    expect(sanitizePreferences(null, base)).not.toHaveProperty('date');
  });
});
