'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { pickLessonToPrefill, type LessonPrefill } from '@/lib/lesson-prefill';
import { defaultPlannerValues, type PlannerValues } from '@/lib/plan-request';
import { LocalStoragePreferencesStore } from '@/lib/preferences-store';
import { LocalStorageScheduleStore, type StorageLike } from '@/lib/schedule-store';
import { parseSearch, type UrlSearch } from '@/lib/url-state';

const browserSearch = () => (typeof window === 'undefined' ? '' : window.location.search);

/**
 * Form state for the planner. On mount (after hydration, storage is
 * browser-only) it restores saved preferences, then applies either the search
 * in the URL (shared link, reload, Back/Forward) or, without one, today's
 * lesson from the weekly schedule. The date is never stored: it is today
 * unless the URL or a lesson says otherwise.
 *
 * - `update` = user edit: changes the form and persists the preferences.
 * - `apply`  = state from a link/history entry: changes the form only, so
 *   opening someone else's link never overwrites the saved preferences.
 */
export function usePlannerValues(
  getStorage: () => StorageLike | null,
  now?: () => Date,
  getSearch: () => string = browserSearch,
) {
  const [values, setValues] = useState<PlannerValues>(() => defaultPlannerValues(now?.()));
  const [ready, setReady] = useState(false);
  const [prefill, setPrefill] = useState<LessonPrefill | null>(null);
  const [urlSearch, setUrlSearch] = useState<UrlSearch | null>(null);
  const store = useRef<LocalStoragePreferencesStore | null>(null);
  const current = useRef(values);

  useEffect(() => {
    const storage = getStorage();
    const base = defaultPlannerValues(now?.());
    store.current = storage ? new LocalStoragePreferencesStore(storage) : null;
    const saved = store.current?.load(base) ?? null;
    const search = parseSearch(getSearch());
    const fromUrl = Object.keys(search.patch).length ? search : null;
    const lesson =
      storage && !fromUrl
        ? pickLessonToPrefill(new LocalStorageScheduleStore(storage).getAll(), now?.())
        : null;
    const next: PlannerValues = {
      ...base,
      ...(saved ?? {}),
      ...(fromUrl?.patch ?? {}),
      ...(lesson
        ? {
            campusId: lesson.lesson.campusId,
            date: lesson.date,
            time: lesson.lesson.time,
            direction: 'outbound',
          }
        : {}),
    };
    current.current = next;
    setValues(next);
    setPrefill(lesson);
    setUrlSearch(fromUrl);
    setReady(true);
    // Run once on mount: later changes come from the user or from history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = useCallback((patch: Partial<PlannerValues>) => {
    const next = { ...current.current, ...patch };
    current.current = next;
    setValues(next);
    return next;
  }, []);

  const update = useCallback(
    (patch: Partial<PlannerValues>) => {
      const next = apply(patch);
      store.current?.save(next);
      return next;
    },
    [apply],
  );

  return { values, update, apply, ready, prefill, urlSearch };
}
