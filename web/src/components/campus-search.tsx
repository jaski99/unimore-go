'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Campus } from '@/lib/api/types';
import { Icon } from './icons';

interface CampusSearchProps {
  campuses: Campus[];
  selectedId: string;
  onChange: (id: string) => void;
}

const labelOf = (campus: Campus) => `${campus.name} · ${campus.city}`;

/**
 * Editable combobox with list autocomplete (WAI-ARIA APG pattern). The input
 * keeps showing the selected campus; focusing it opens the full list (the
 * text is selected, so typing replaces it and filters). Escape or leaving
 * the field restores the selected label.
 */
export function CampusSearch({ campuses, selectedId, onChange }: CampusSearchProps) {
  /** null = not filtering: the input shows the selected label, the list shows every campus. */
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  /** The click that focused the input must not undo the selection (mouseup moves the caret). */
  const focusedByPointer = useRef(false);
  const selected = campuses.find((campus) => campus.id === selectedId);

  const filtered = useMemo(() => {
    const normalized = query?.trim().toLocaleLowerCase('it');
    if (!normalized) return campuses;
    return campuses.filter((campus) =>
      `${campus.name} ${campus.city}`.toLocaleLowerCase('it').includes(normalized),
    );
  }, [campuses, query]);
  const active = open ? filtered[activeIndex] : undefined;

  useEffect(() => {
    if (!active) return;
    list.current
      ?.querySelector<HTMLElement>(`#campus-option-${active.id}`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  /**
   * Select the whole label so that typing replaces it. `select()` inside the
   * focus handler is undone by iOS Safari and by the caret placement of the
   * tap, so the selection is (re)applied with setSelectionRange after the
   * frame, only while the field still shows the chosen label.
   */
  function selectAll(element: HTMLInputElement) {
    element.select();
    const label = element.value;
    requestAnimationFrame(() => {
      if (document.activeElement === element && element.value === label)
        element.setSelectionRange(0, label.length);
    });
  }

  function openList() {
    setOpen(true);
    const index = filtered.findIndex((campus) => campus.id === selectedId);
    setActiveIndex(query === null && index >= 0 ? index : 0);
  }

  function close() {
    setOpen(false);
    setQuery(null);
  }

  function choose(campus: Campus) {
    onChange(campus.id);
    close();
  }

  return (
    <div className="relative">
      <label className="field-label" htmlFor="campus-search">
        Sede UNIMORE
      </label>
      <div className="relative">
        <input
          ref={input}
          id="campus-search"
          className="field-input pr-11"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="campus-options"
          aria-expanded={open}
          aria-activedescendant={active ? `campus-option-${active.id}` : undefined}
          aria-describedby={selected ? 'campus-selected campus-search-hint' : 'campus-search-hint'}
          autoComplete="off"
          title={selected ? labelOf(selected) : undefined}
          value={query ?? (selected ? labelOf(selected) : '')}
          placeholder="Cerca una sede…"
          onFocus={(event) => {
            selectAll(event.currentTarget);
            openList();
          }}
          onMouseDown={(event) => {
            focusedByPointer.current = document.activeElement !== event.currentTarget;
          }}
          onClick={(event) => {
            if (focusedByPointer.current) selectAll(event.currentTarget);
            focusedByPointer.current = false;
            if (!open) openList();
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              if (!open) return openList();
              if (filtered.length) setActiveIndex((index) => (index + 1) % filtered.length);
            }
            if (event.key === 'ArrowUp' && open && filtered.length) {
              event.preventDefault();
              setActiveIndex((index) => (index - 1 + filtered.length) % filtered.length);
            }
            if (event.key === 'Enter' && active) {
              event.preventDefault();
              choose(active);
            }
            if (event.key === 'Escape') {
              if (open) event.preventDefault();
              close();
            }
            if (event.key === 'Tab') close();
          }}
          onBlur={close}
        />
        <button
          type="button"
          tabIndex={-1}
          className="campus-toggle"
          aria-label="Mostra tutte le sedi"
          aria-controls="campus-options"
          aria-expanded={open}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (open) return close();
            setQuery(null);
            input.current?.focus();
            openList();
          }}
        >
          <Icon name="chevron" className={`h-5 w-5 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {selected && (
        // The input cuts long names: the full one stays readable here (point 10).
        <p id="campus-selected" className="field-hint break-words">
          Sede scelta: {labelOf(selected)}
        </p>
      )}
      <p id="campus-search-hint" className="sr-only">
        Scrivi per filtrare, frecce per scegliere, Invio per confermare.
      </p>
      <ul
        ref={list}
        id="campus-options"
        role="listbox"
        aria-label="Sedi UNIMORE"
        className="campus-options"
        hidden={!open}
      >
        {filtered.map((campus, index) => (
          <li
            key={campus.id}
            id={`campus-option-${campus.id}`}
            role="option"
            aria-selected={campus.id === selectedId}
            className={`campus-option ${index === activeIndex ? 'campus-option-active' : ''}`}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => choose(campus)}
          >
            <span>{campus.name}</span>
            <span className="shrink-0 text-xs text-slate-600 dark:text-slate-400">
              {campus.city}
            </span>
          </li>
        ))}
      </ul>
      {open && !filtered.length && (
        <p role="status" className="campus-options px-4 py-3 text-sm text-slate-600">
          Nessuna sede trovata
        </p>
      )}
    </div>
  );
}
