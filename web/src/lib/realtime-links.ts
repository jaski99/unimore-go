/**
 * Public Trenitalia pages for checking a planned train in real time (no API,
 * no key). Trenitalia does not document a URL that opens a single train's
 * page, so the user searches the train number on ViaggiaTreno.
 */
export const VIAGGIATRENO_URL = 'http://www.viaggiatreno.it/infomobilita/index.jsp';
export const INFOMOBILITA_URL =
  'https://www.trenitalia.com/it/informazioni/Infomobilita/notizie-infomobilita.html';

export interface RealtimeLink {
  label: string;
  href: string;
  description: string;
}

export function realtimeLinks(trainNumber?: string): RealtimeLink[] {
  return [
    {
      label: 'ViaggiaTreno',
      href: VIAGGIATRENO_URL,
      description: trainNumber
        ? `Cerca il treno ${trainNumber}: ritardo e binario in tempo reale`
        : 'Ritardi e binari in tempo reale',
    },
    {
      label: 'Infomobilità Trenitalia',
      href: INFOMOBILITA_URL,
      description: 'Scioperi, lavori e circolazione',
    },
  ];
}
