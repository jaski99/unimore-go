'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Campus } from '@/lib/api/types';
import type { PlanService } from '@/lib/api/plan-service';
import { pickLessonToPrefill } from '@/lib/lesson-prefill';
import { buildPlanRequest, validatePlannerValues, type PlannerValues } from '@/lib/plan-request';
import type { LocalStorageScheduleStore, ScheduledClass, Weekday } from '@/lib/schedule-store';
import { formatClock, formatShortDate, getNextDateForWeekday } from '@/lib/time-format';
import { Icon } from './icons';

const weekdays = [
  { id: 1, label: 'Lunedì' },
  { id: 2, label: 'Martedì' },
  { id: 3, label: 'Mercoledì' },
  { id: 4, label: 'Giovedì' },
  { id: 5, label: 'Venerdì' },
  { id: 6, label: 'Sabato' },
  { id: 0, label: 'Domenica' },
] as const;

export interface LessonSelection {
  campusId: string;
  date: string;
  time: string;
}

interface SchedulePanelProps {
  store: LocalStorageScheduleStore | null;
  campuses: Campus[];
  /** Current planner settings (origin, mode, buffer, categories) reused for the preview. */
  values: PlannerValues;
  service: PlanService;
  onSelectClass: (selection: LessonSelection) => void;
}

/** Plan request for the next lesson, built from the user's own settings. */
export function nextLessonRequest(values: PlannerValues, lesson: LessonSelection) {
  const lessonValues: PlannerValues = { ...values, ...lesson, direction: 'outbound' };
  return validatePlannerValues(lessonValues) ? null : buildPlanRequest(lessonValues);
}

export function SchedulePanel({
  store,
  campuses,
  values,
  service,
  onSelectClass,
}: SchedulePanelProps) {
  const [lessons, setLessons] = useState<ScheduledClass[]>([]);
  const [weekday, setWeekday] = useState<Weekday>(1);
  const [time, setTime] = useState('08:30');
  const [campusId, setCampusId] = useState(campuses[0]?.id ?? 'dief');
  const [leave, setLeave] = useState<{ key: string; leaveAt: string | null } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore persisted lessons from the injected storage adapter.
    setLessons(store?.getAll() ?? []);
  }, [store]);

  const upcoming = useMemo(() => pickLessonToPrefill(lessons), [lessons]);
  const requestKey = useMemo(() => {
    if (!upcoming) return '';
    const request = nextLessonRequest(values, {
      campusId: upcoming.lesson.campusId,
      date: upcoming.date,
      time: upcoming.lesson.time,
    });
    return request ? JSON.stringify(request) : '';
  }, [upcoming, values]);

  useEffect(() => {
    if (!requestKey) return;
    let active = true;
    service
      .createPlan(JSON.parse(requestKey))
      .then((response) => {
        if (active)
          setLeave({ key: requestKey, leaveAt: response.itineraries[0]?.leave_at ?? null });
      })
      .catch(() => {
        if (active) setLeave({ key: requestKey, leaveAt: null });
      });
    return () => {
      active = false;
    };
  }, [requestKey, service]);

  const nextInfo = upcoming
    ? {
        lesson: upcoming.lesson,
        date: upcoming.date,
        pending: leave?.key !== requestKey,
        leaveAt: leave?.key === requestKey ? leave.leaveAt : null,
      }
    : null;

  const nextCampus = campuses.find((campus) => campus.id === nextInfo?.lesson.campusId);

  function addClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!store || !campusId) return;
    setLessons(store.add({ weekday, time, campusId }));
  }

  function selectClass(lesson: ScheduledClass) {
    onSelectClass({
      campusId: lesson.campusId,
      date: pickLessonToPrefill([lesson])?.date ?? getNextDateForWeekday(lesson.weekday),
      time: lesson.time,
    });
    document.getElementById('plan-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <section className="schedule-card" aria-labelledby="schedule-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-kicker">La settimana, in tasca</p>
          <h2 id="schedule-heading" className="mt-1 text-xl font-bold text-ink dark:text-white">
            Il mio orario settimanale
          </h2>
        </div>
        <div className="schedule-icon">
          <Icon name="calendar" className="h-5 w-5" />
        </div>
      </div>
      {nextInfo && (
        <div className="next-class mt-5" aria-live="polite">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-pine dark:text-emerald-300">
              Prossima lezione
            </p>
            <p className="mt-1 truncate font-semibold text-ink dark:text-white">
              {nextCampus?.name} · {formatShortDate(nextInfo.date)}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Inizio alle {nextInfo.lesson.time} ·{' '}
              {nextInfo.pending ? (
                'calcolo…'
              ) : nextInfo.leaveAt ? (
                <>
                  esci alle{' '}
                  <strong className="text-pine dark:text-emerald-300">
                    {formatClock(nextInfo.leaveAt)}
                  </strong>
                </>
              ) : (
                'nessun treno trovato'
              )}
            </p>
          </div>
          <Icon name="arrow" className="h-5 w-5 shrink-0 text-pine" />
        </div>
      )}
      {!store && <p className="mt-4 text-sm text-slate-600">Caricamento orario salvato…</p>}
      {store && lessons.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-700">
          {lessons.map((lesson) => {
            const campus = campuses.find((item) => item.id === lesson.campusId);
            const dayLabel = weekdays.find((day) => day.id === lesson.weekday)?.label;
            return (
              <li className="flex items-center gap-3 py-3" key={lesson.id}>
                <div className="lesson-time">{lesson.time}</div>
                <button
                  type="button"
                  onClick={() => selectClass(lesson)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-semibold text-ink hover:text-pine dark:text-white">
                    {campus?.name ?? 'Sede non trovata'}
                  </span>
                  <span className="text-xs text-slate-600">{dayLabel}</span>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Rimuovi lezione ${dayLabel} ${lesson.time}`}
                  onClick={() => setLessons(store.remove(lesson.id))}
                >
                  <Icon name="close" className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {store && lessons.length === 0 && (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Aggiungi una lezione: verrà salvata solo su questo dispositivo.
        </p>
      )}
      <form
        className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-200 pt-5 dark:border-slate-700"
        onSubmit={addClass}
      >
        <div>
          <label className="field-label" htmlFor="schedule-day">
            Giorno
          </label>
          <select
            id="schedule-day"
            className="field-input"
            value={weekday}
            onChange={(event) => setWeekday(Number(event.target.value) as Weekday)}
          >
            {weekdays.map((day) => (
              <option key={day.id} value={day.id}>
                {day.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="schedule-time">
            Ora
          </label>
          <input
            id="schedule-time"
            className="field-input"
            type="time"
            required
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </div>
        <div className="col-span-2">
          <label className="field-label" htmlFor="schedule-campus">
            Sede
          </label>
          <select
            id="schedule-campus"
            className="field-input"
            value={campusId}
            onChange={(event) => setCampusId(event.target.value)}
          >
            {campuses.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.name} · {campus.city}
              </option>
            ))}
          </select>
        </div>
        <button className="secondary-button col-span-2" type="submit" disabled={!store}>
          <span className="text-lg leading-none">+</span> Aggiungi lezione
        </button>
      </form>
    </section>
  );
}
