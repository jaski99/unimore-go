import { describe, expect, it } from 'vitest';
import { LocalStorageScheduleStore, type StorageLike } from './schedule-store';

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe('LocalStorageScheduleStore', () => {
  it('aggiunge, legge e rimuove una lezione', () => {
    const store = new LocalStorageScheduleStore(new MemoryStorage(), () => 'lesson-1');
    const saved = store.add({ weekday: 1, time: '08:30', campusId: 'dief' });
    expect(saved).toEqual([{ id: 'lesson-1', weekday: 1, time: '08:30', campusId: 'dief' }]);
    expect(store.getAll()).toEqual(saved);
    expect(store.remove('lesson-1')).toEqual([]);
  });

  it('gestisce storage vuoto o JSON corrotto senza bloccare l’interfaccia', () => {
    const storage = new MemoryStorage();
    const store = new LocalStorageScheduleStore(storage, () => 'lesson-2');
    expect(store.getAll()).toEqual([]);
    storage.setItem('unimorego.schedule.v1', '{broken');
    expect(store.getAll()).toEqual([]);
  });
});
