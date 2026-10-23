import type { Notice, PlanResponse } from '@/lib/api/types';

/** Notices of a response; v0.4 responses (warnings only) are mapped by their wording. */
export function noticesOf(result: PlanResponse | null | undefined): Notice[] {
  if (!result) return [];
  if (result.notices?.length) return result.notices;
  return result.warnings.map(legacyNotice);
}

function legacyNotice(message: string): Notice {
  if (message.startsWith('Orari pianificati'))
    return { code: 'not_realtime', level: 'info', message };
  if (message.startsWith('Nessun treno')) return { code: 'no_service', level: 'warning', message };
  if (message.includes('validità')) return { code: 'out_of_validity', level: 'warning', message };
  return { code: 'generic', level: 'info', message };
}

export interface NoticeGroups {
  /** "Nessun treno …" (shown as the headline of an empty result). */
  noService?: Notice;
  /** Warnings and errors, most important first (one alert each). */
  alerts: Notice[];
  /** Informative notes (holiday, estimates). */
  infos: Notice[];
  /** "Non in tempo reale" (shown next to the real-time links). */
  realtime?: Notice;
}

/** Split API notices (already sorted by priority) into the parts of the result card. */
export function groupNotices(notices: Notice[]): NoticeGroups {
  const groups: NoticeGroups = { alerts: [], infos: [] };
  for (const notice of notices) {
    if (notice.code === 'no_service') groups.noService ??= notice;
    else if (notice.code === 'not_realtime') groups.realtime ??= notice;
    else if (notice.level === 'info') groups.infos.push(notice);
    else groups.alerts.push(notice);
  }
  return groups;
}
