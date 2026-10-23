import { describe, expect, it, vi } from 'vitest';
import { copyLink, shareFeedback, shareLink } from './share';

const data = { url: 'https://example.test/?sede=dief', title: 'UnimoreGo' };

describe('shareLink', () => {
  it('usa la Web Share API quando c’è', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    expect(await shareLink(data, { share, clipboard: { writeText } })).toBe('shared');
    expect(share).toHaveBeenCalledWith(data);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('se la condivisione non è disponibile copia il link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareLink(data, { clipboard: { writeText } })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(data.url);
    const canShare = () => false;
    expect(await shareLink(data, { share: vi.fn(), canShare, clipboard: { writeText } })).toBe(
      'copied',
    );
  });

  it('annullare la condivisione non copia nulla', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('chiuso', 'AbortError'));
    const writeText = vi.fn();
    expect(await shareLink(data, { share, clipboard: { writeText } })).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('se la condivisione fallisce per altri motivi ripiega sugli appunti', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareLink(data, { share, clipboard: { writeText } })).toBe('copied');
  });
});

describe('copyLink', () => {
  it('riporta gli errori degli appunti', async () => {
    expect(await copyLink('x', {})).toBe('failed');
    const writeText = vi.fn().mockRejectedValue(new Error('negato'));
    expect(await copyLink('x', { clipboard: { writeText } })).toBe('failed');
  });

  it('ha un messaggio per ogni esito', () => {
    expect(shareFeedback('copied')).toBe('Link copiato negli appunti.');
    expect(shareFeedback('shared')).toBe('Link condiviso.');
    expect(shareFeedback('cancelled')).toBe('');
    expect(shareFeedback('failed')).toContain('barra degli indirizzi');
  });
});
