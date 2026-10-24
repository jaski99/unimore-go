import type { Campus } from '@/lib/api/types';

const ACRONYM = /\(([A-Z]{2,10})\)\s*$/;
const DEPARTMENT = /^Dipartimento\b/i;
const withoutTrailingParenthesis = (value: string) => value.replace(/\s*\([^)]*\)\s*$/, '').trim();

/**
 * The name people use for a campus:
 * - an acronym in final parentheses: "… 'Enzo Ferrari' (DIEF)" -> "DIEF";
 * - else the part that is not the department: "… - Palazzo Dossetti" -> "Palazzo Dossetti";
 * - else the department without "Dipartimento di" and the final place:
 *   "Dipartimento di Economia 'Marco Biagi' (Foro Boario)" -> "Economia 'Marco Biagi'".
 */
export function shortCampusName(name: string): string {
  const acronym = name.match(ACRONYM)?.[1];
  if (acronym) return acronym;
  const parts = name.split(' - ').map((part) => part.trim());
  const place = parts.length > 1 ? parts.find((part) => !DEPARTMENT.test(part)) : undefined;
  if (place) return withoutTrailingParenthesis(place);
  return withoutTrailingParenthesis(name.replace(/^Dipartimento di\s+/i, '')) || name;
}

/** Text of the campus field once chosen: "DIEF · Modena" (round 4, point 6). */
export function campusShortLabel(campus: Campus): string {
  return `${shortCampusName(campus.name)} · ${campus.city}`;
}

/** Full name for the list, the tooltip and screen readers. */
export function campusFullLabel(campus: Campus): string {
  return `${campus.name} · ${campus.city}`;
}
