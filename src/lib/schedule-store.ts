export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ScheduledClass {
  id: string;
  weekday: Weekday;
  time: string;
  campusId: string;
}

export interface NewScheduledClass {
  weekday: Weekday;
  time: string;
  campusId: string;
}

export interface ScheduleStore {
  getAll(): ScheduledClass[];
  add(lesson: NewScheduledClass): ScheduledClass[];
  remove(id: string): ScheduledClass[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_KEY = 'unimorego.schedule.v1';

export class LocalStorageScheduleStore implements ScheduleStore {
  constructor(
    private readonly storage: StorageLike,
    private readonly createId: () => string = () => globalThis.crypto.randomUUID(),
  ) {}

  getAll(): ScheduledClass[] {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isScheduledClass);
    } catch {
      return [];
    }
  }

  add(lesson: NewScheduledClass): ScheduledClass[] {
    const all = [...this.getAll(), { ...lesson, id: this.createId() }];
    this.write(all);
    return all;
  }

  remove(id: string): ScheduledClass[] {
    const all = this.getAll().filter((lesson) => lesson.id !== id);
    this.write(all);
    return all;
  }

  private write(lessons: ScheduledClass[]): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(lessons));
  }
}

function isScheduledClass(value: unknown): value is ScheduledClass {
  if (!value || typeof value !== 'object') return false;
  const lesson = value as Partial<ScheduledClass>;
  return (
    typeof lesson.id === 'string' &&
    typeof lesson.time === 'string' &&
    typeof lesson.campusId === 'string' &&
    Number.isInteger(lesson.weekday) &&
    Number(lesson.weekday) >= 0 &&
    Number(lesson.weekday) <= 6
  );
}
