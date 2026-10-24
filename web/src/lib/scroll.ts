/**
 * Smooth scrolling unless the user asked for reduced motion (round 4, point 9).
 * "instant", not "auto": "auto" follows the CSS `scroll-behavior: smooth` of <html>.
 */
export function scrollBehavior(): ScrollBehavior {
  const reduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduced ? 'instant' : 'smooth';
}

/** Bring an element to the top of the viewport (e.g. the answer after "Calcola"). */
export function scrollToElement(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
}
