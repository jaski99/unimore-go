import type { Campus, Station } from '@/lib/api/types';

// Coordinates are sourced from OpenStreetMap Nominatim search results; attribution: https://www.openstreetmap.org/copyright.
// DIEF (OSM way 194635328), Economia Marco Biagi (way 167305594), Giurisprudenza (way 646579380),
// San Lazzaro (way 372676430), Reggio Emilia FS (node 82549162), Modena FS (node 726611782).
// Palazzo Dossetti location is the OSM way 168135047, also indexed at https://nominatim.openstreetmap.org/.
export const CAMPUSES: Campus[] = [
  {
    id: 'dief',
    name: 'DIEF Ingegneria · via Vivarelli 10',
    city: 'Modena',
    lat: 44.6292268,
    lon: 10.9492319,
  },
  {
    id: 'economia-marco-biagi',
    name: 'Economia Marco Biagi',
    city: 'Modena',
    lat: 44.6500719,
    lon: 10.9230943,
  },
  {
    id: 'giurisprudenza',
    name: 'Giurisprudenza',
    city: 'Modena',
    lat: 44.6433902,
    lon: 10.9259537,
  },
  {
    id: 'palazzo-dossetti',
    name: 'Palazzo Dossetti',
    city: 'Reggio Emilia',
    lat: 44.70237,
    lon: 10.6288,
  },
  {
    id: 'san-lazzaro',
    name: 'San Lazzaro',
    city: 'Reggio Emilia',
    lat: 44.6881565,
    lon: 10.6651731,
  },
];

export const STATIONS: Station[] = [
  {
    id: 'reggio-emilia-fs',
    name: 'Reggio Emilia FS',
    city: 'Reggio Emilia',
    lat: 44.6976226,
    lon: 10.6432684,
  },
  { id: 'modena-fs', name: 'Modena FS', city: 'Modena', lat: 44.6543308, lon: 10.9305293 },
];
