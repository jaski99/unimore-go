'use client';

import type { ReactNode } from 'react';
import { Icon } from './icons';
import { TimeSelect } from './time-select';

interface ReturnTripProps {
  /** Lesson end "HH:MM". */
  endTime: string;
  onEndTimeChange: (time: string) => void;
  onCalculate: () => void;
  loading: boolean;
  /** The return result, once requested (rendered under the controls). */
  children?: ReactNode;
}

/** "Calcola il ritorno" with the outbound settings: only the lesson end changes. */
export function ReturnTrip({
  endTime,
  onEndTimeChange,
  onCalculate,
  loading,
  children,
}: ReturnTripProps) {
  return (
    <section className="return-trip" aria-labelledby="return-title">
      <h3 id="return-title" className="text-base font-bold text-ink dark:text-white">
        E per tornare?
      </h3>
      <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
        Stesso giorno, stessa sede, stessa stazione e stesso mezzo dell’andata.
      </p>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <TimeSelect
          id="return-end"
          label="Fine lezione"
          value={endTime}
          onChange={onEndTimeChange}
        />
        <button
          type="button"
          className="secondary-button whitespace-nowrap"
          onClick={onCalculate}
          disabled={loading}
        >
          <Icon name="back" className="h-4 w-4" />
          {loading ? 'Calcolo…' : 'Calcola il ritorno'}
        </button>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}
