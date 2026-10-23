'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './icons';

/**
 * Toggletip: a small "?" button that shows a short explanation on click/tap
 * (hover-only tooltips do not work on touch). The text is announced through
 * a live region; Esc or a click outside closes it.
 */
export function HelpTip({
  label,
  children,
  align = 'start',
}: {
  label: string;
  children: React.ReactNode;
  /** Which edge of the bubble lines up with the button (keeps it on screen). */
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={root} className="help-tip">
      <button
        type="button"
        className="help-tip-button"
        aria-label={`Che cos’è: ${label}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="help" className="h-4 w-4" />
      </button>
      <span id={id} role="status" className={`help-tip-bubble help-tip-${align}`} hidden={!open}>
        {open ? children : null}
      </span>
    </span>
  );
}
