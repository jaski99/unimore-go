import { describe, expect, it } from 'vitest';
import fixtures from '@/lib/api/mock-fixtures.json';
import type { Campus } from '@/lib/api/types';
import { campusFullLabel, campusShortLabel, shortCampusName } from './campus-name';

const dief = {
  id: 'dief',
  name: "Dipartimento di Ingegneria 'Enzo Ferrari' (DIEF)",
  city: 'Modena',
} as Campus;
const dossetti = {
  id: 'palazzo_dossetti',
  name: 'Palazzo Dossetti',
  city: 'Reggio Emilia',
} as Campus;

describe('campus names', () => {
  it('nomi brevi delle cinque sedi reali', () => {
    const short = Object.fromEntries(
      fixtures.campuses.map((campus) => [campus.id, shortCampusName(campus.name)]),
    );
    expect(short).toEqual({
      dief: 'DIEF',
      palazzo_dossetti: 'Palazzo Dossetti',
      campus_san_lazzaro: 'Campus San Lazzaro',
      economia_biagi: "Economia 'Marco Biagi'",
      giurisprudenza: 'Giurisprudenza',
    });
    expect(shortCampusName('Palazzo Dossetti')).toBe('Palazzo Dossetti');
  });

  it('campo sede: nome breve e città; elenco e tooltip: nome completo', () => {
    expect(campusShortLabel(dief)).toBe('DIEF · Modena');
    expect(campusShortLabel(dossetti)).toBe('Palazzo Dossetti · Reggio Emilia');
    expect(campusFullLabel(dief)).toBe("Dipartimento di Ingegneria 'Enzo Ferrari' (DIEF) · Modena");
  });
});
