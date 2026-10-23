import type { ReactNode, SVGProps } from 'react';

type IconName =
  'walk' | 'bike' | 'train' | 'pin' | 'calendar' | 'clock' | 'arrow' | 'close' | 'sun' | 'spark';

const paths: Record<IconName, ReactNode> = {
  walk: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="m10 22 2-7-3-3 2-5 4 3 2 5-3 2-1 5M9 11l-4 4" />
    </>
  ),
  bike: (
    <>
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <path d="m15 6 3 0 2 3M12 17.5 8 10h5l5 7.5M8 10l-2.5 7.5M12 17.5l4-7.5" />
    </>
  ),
  train: (
    <>
      <rect x="5" y="3" width="14" height="16" rx="3" />
      <path d="M8 7h8M8 12h.01M16 12h.01M8 19l-2 3m10-3 2 3M7 16h10" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </>
  ),
  close: (
    <>
      <path d="m18 6-12 12M6 6l12 12" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Zm7 12 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
    </>
  ),
};

export function Icon({ name, className, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
