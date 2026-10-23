'use client';

import { useId } from 'react';

const pad = (value: number) => String(value).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, hour) => pad(hour));

/** Minute options every `step` minutes, plus the current value when it is off-step. */
export function minuteOptions(current: string, step = 5): string[] {
  const options = Array.from({ length: Math.ceil(60 / step) }, (_, index) => pad(index * step));
  return options.includes(current) ? options : [...options, current].sort();
}

interface TimeSelectProps {
  id: string;
  label: string;
  /** "HH:MM" */
  value: string;
  onChange: (value: string) => void;
  step?: number;
}

/**
 * 24-hour time picker made of two native selects (hours, minutes): native
 * <input type="time"> may show AM/PM depending on the device locale.
 */
export function TimeSelect({ id, label, value, onChange, step = 5 }: TimeSelectProps) {
  const labelId = useId();
  const [hour = '08', minute = '00'] = value.split(':');
  return (
    <div role="group" aria-labelledby={labelId}>
      <span id={labelId} className="field-label">
        {label}
      </span>
      <div className="time-select">
        <select
          id={id}
          className="field-input"
          aria-label="Ore"
          value={hour}
          onChange={(event) => onChange(`${event.target.value}:${minute}`)}
        >
          {HOURS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="font-bold text-slate-600">
          :
        </span>
        <select
          className="field-input"
          aria-label="Minuti"
          value={minute}
          onChange={(event) => onChange(`${hour}:${event.target.value}`)}
        >
          {minuteOptions(minute, step).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
