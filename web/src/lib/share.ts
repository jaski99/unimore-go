/** Share a link with the Web Share API, falling back to the clipboard. */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export interface ShareEnvironment {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  clipboard?: { writeText: (text: string) => Promise<void> };
}

export function browserShareEnvironment(): ShareEnvironment {
  if (typeof navigator === 'undefined') return {};
  return {
    share: navigator.share?.bind(navigator),
    canShare: navigator.canShare?.bind(navigator),
    clipboard: navigator.clipboard,
  };
}

export async function copyLink(
  url: string,
  env = browserShareEnvironment(),
): Promise<ShareOutcome> {
  if (!env.clipboard) return 'failed';
  try {
    await env.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export async function shareLink(
  data: { url: string; title: string; text?: string },
  env = browserShareEnvironment(),
): Promise<ShareOutcome> {
  if (env.share && (!env.canShare || env.canShare(data))) {
    try {
      await env.share(data);
      return 'shared';
    } catch (cause) {
      // The user closed the share sheet: not an error, and no clipboard surprise.
      if (cause instanceof DOMException && cause.name === 'AbortError') return 'cancelled';
    }
  }
  return copyLink(data.url, env);
}

export function shareFeedback(outcome: ShareOutcome): string {
  switch (outcome) {
    case 'copied':
      return 'Link copiato negli appunti.';
    case 'shared':
      return 'Link condiviso.';
    case 'cancelled':
      return '';
    default:
      return 'Non è stato possibile copiare il link: copialo dalla barra degli indirizzi.';
  }
}
