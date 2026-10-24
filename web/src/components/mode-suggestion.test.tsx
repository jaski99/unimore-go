import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Itinerary, ModeSuggestion } from '@/lib/api/types';
import { ModeSuggestionCallout } from './mode-suggestion';

const suggestion: ModeSuggestion = {
  mode: 'bike',
  minutes: 22,
  message: 'In bici circa 22 min (a piedi 53 min).',
};
const walkOnly = {
  leave_at: '07:27',
  arrive_at: '08:20',
  slack_min: 10,
  legs: [
    { type: 'walk', from: 'Modena FS', to: 'DIEF', depart: '07:27', arrive: '08:20', minutes: 53 },
  ],
} as unknown as Itinerary;

describe('ModeSuggestionCallout (round 5, punto 3)', () => {
  it('mostra la bici in evidenza e ricalcola solo con "Usa la bici"', async () => {
    const user = userEvent.setup();
    const onUse = vi.fn();
    render(<ModeSuggestionCallout suggestion={suggestion} itinerary={walkOnly} onUse={onUse} />);
    const group = screen.getByRole('group', { name: 'Suggerimento: bici' });
    expect(group).toHaveTextContent('In bici circa 22 min');
    expect(group).toHaveTextContent('A piedi 53 min, il mezzo che hai scelto.');
    expect(onUse).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Usa la bici' }));
    expect(onUse).toHaveBeenCalledWith(suggestion);
  });
});
