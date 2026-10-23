import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'walk'
  | 'bike'
  | 'train'
  | 'wait'
  | 'pin'
  | 'calendar'
  | 'clock'
  | 'arrow'
  | 'close'
  | 'sun'
  | 'spark'
  | 'home'
  | 'search'
  | 'alert'
  | 'ticket'
  | 'map'
  | 'back'
  | 'chevron'
  | 'share'
  | 'link'
  | 'help'
  | 'copy';

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
  wait: (
    <>
      <path d="M7 3h10M7 21h10M8 3c0 4 8 5 8 9s-8 5-8 9M16 3c0 4-8 5-8 9" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-7 9 7" />
      <path d="M5 10v10h14V10M10 20v-5h4v5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.5-4.5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 2.5 20h19L12 4Z" />
      <path d="M12 10v4m0 3v.01" />
    </>
  ),
  ticket: (
    <>
      <path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V7Z" />
      <path d="M14 7v10" strokeDasharray="2 2" />
    </>
  ),
  map: (
    <>
      <path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" />
      <path d="M9 4v14m6-12v14" />
    </>
  ),
  back: (
    <>
      <path d="M19 12H5m6 6-6-6 6-6" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </>
  ),
  link: (
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
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
