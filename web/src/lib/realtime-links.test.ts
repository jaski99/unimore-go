import { describe, expect, it } from 'vitest';
import { INFOMOBILITA_URL, realtimeLinks, VIAGGIATRENO_URL } from './realtime-links';

describe('realtimeLinks', () => {
  it('rimanda alle pagine pubbliche Trenitalia con il numero del treno da cercare', () => {
    const [viaggiatreno, infomobilita] = realtimeLinks('3907');
    expect(viaggiatreno).toMatchObject({ label: 'ViaggiaTreno', href: VIAGGIATRENO_URL });
    expect(viaggiatreno.description).toContain('Cerca il treno 3907');
    expect(infomobilita.href).toBe(INFOMOBILITA_URL);
  });

  it('senza treno non cita un numero', () => {
    expect(realtimeLinks()[0].description).not.toContain('Cerca il treno');
  });
});
