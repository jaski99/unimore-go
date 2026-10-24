'use client';

import { useDelayedFlag } from '@/hooks/use-delayed-flag';

/** How long the health check may take before "Connessione…" is shown. */
export const CONNECTING_DELAY_MS = 500;

export interface ApiStatusProps {
  demoMode: boolean;
  /** `/api/health` answered "ok". */
  online: boolean;
  /** The health check / catalog request is still running. */
  loading: boolean;
}

/**
 * Header status pill (round 5, point 5). A fast start shows "API collegata"
 * directly: during the first `CONNECTING_DELAY_MS` the pill keeps its place
 * but stays invisible, so neither a "Connessione…" flash nor a layout shift.
 */
export function ApiStatus({ demoMode, online, loading }: ApiStatusProps) {
  const waiting = !demoMode && !online && loading;
  const slow = useDelayedFlag(waiting, CONNECTING_DELAY_MS);
  const label = demoMode
    ? 'Dati registrati'
    : online
      ? 'API collegata'
      : loading
        ? 'Connessione…'
        : 'API non raggiungibile';
  const hidden = waiting && !slow;
  return (
    <span
      className={`status-pill ${online ? 'status-online' : ''} ${hidden ? 'invisible' : ''}`}
      aria-hidden={hidden || undefined}
      data-testid="api-status"
    >
      <i />
      {label}
    </span>
  );
}
