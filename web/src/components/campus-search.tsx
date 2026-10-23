'use client';

import { useMemo, useState } from 'react';
import type { Campus } from '@/lib/api/types';

interface CampusSearchProps {
  campuses: Campus[];
  selectedId: string;
  onChange: (id: string) => void;
}

export function CampusSearch({ campuses, selectedId, onChange }: CampusSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = campuses.find((campus) => campus.id === selectedId);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('it');
    if (!normalized) return campuses;
    return campuses.filter((campus) =>
      `${campus.name} ${campus.city}`.toLocaleLowerCase('it').includes(normalized),
    );
  }, [campuses, query]);

  function choose(campus: Campus) {
    onChange(campus.id);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="relative">
      <label className="field-label" htmlFor="campus-search">
        Sede UNIMORE
      </label>
      <input
        id="campus-search"
        className="field-input"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="campus-options"
        aria-expanded={open}
        aria-activedescendant={
          open && filtered[activeIndex] ? `campus-option-${filtered[activeIndex].id}` : undefined
        }
        autoComplete="off"
        value={open ? query : selected ? `${selected.name} · ${selected.city}` : query}
        placeholder="Cerca una sede…"
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && filtered.length) {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % filtered.length);
          }
          if (event.key === 'ArrowUp' && filtered.length) {
            event.preventDefault();
            setActiveIndex((index) => (index - 1 + filtered.length) % filtered.length);
          }
          if (event.key === 'Enter' && open && filtered[activeIndex]) {
            event.preventDefault();
            choose(filtered[activeIndex]);
          }
          if (event.key === 'Escape' || event.key === 'Tab') setOpen(false);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      {open && (
        <ul id="campus-options" role="listbox" className="campus-options">
          {filtered.length ? (
            filtered.map((campus, index) => (
              <li
                key={campus.id}
                id={`campus-option-${campus.id}`}
                role="option"
                aria-selected={campus.id === selectedId}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  className={`campus-option ${index === activeIndex ? 'campus-option-active' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(campus)}
                >
                  <span>{campus.name}</span>
                  <span className="text-xs text-slate-600">{campus.city}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-sm text-slate-600">Nessuna sede trovata</li>
          )}
        </ul>
      )}
    </div>
  );
}
