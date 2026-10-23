'use client';

import { useCallback, useEffect, useState } from 'react';
import { pickLessonToPrefill, type LessonPrefill } from '@/lib/lesson-prefill';
import { defaultPlannerValues, type PlannerValues } from '@/lib/plan-request';
import { LocalStoragePreferencesStore } from '@/lib/preferences-store';
import { LocalStorageScheduleStore, type StorageLike } from '@/lib/schedule-store';

/**
 * Form state for the planner: restores saved preferences, prefills today's
 * lesson from the weekly schedule and persists every change (localStorage).
 * `getStorage` is called after hydration because storage is browser-only.
 */
export function usePlannerValues(getStorage: () => StorageLike | null, now?: () => Date) {
  const [values, setValues] = useState<PlannerValues>(() => defaultPlannerValues(now?.()));
  const [ready, setReady] = useState(false);
  const [prefill, setPrefill] = useState<LessonPrefill | null>(null);
  const [store, setStore] = useState<LocalStoragePreferencesStore | null>(null);

  useEffect(() => {
    const storage = getStorage();
    const base = defaultPlannerValues(now?.());
    const preferences = storage ? new LocalStoragePreferencesStore(storage) : null;
    const saved = preferences?.load(base) ?? null;
    const lesson = storage
      ? pickLessonToPrefill(new LocalStorageScheduleStore(storage).getAll(), now?.())
      : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage is only readable after hydration.
    setValues({
      ...base,
      ...(saved ?? {}),
      ...(lesson
        ? {
            campusId: lesson.lesson.campusId,
            date: lesson.date,
            time: lesson.lesson.time,
            direction: 'outbound',
          }
        : {}),
    });
    setPrefill(lesson);
    setStore(preferences);
    setReady(true);
    // Run once on mount: later changes come from the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready) store?.save(values);
  }, [ready, store, values]);

  const update = useCallback((patch: Partial<PlannerValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  }, []);

  return { values, update, ready, prefill };
}
