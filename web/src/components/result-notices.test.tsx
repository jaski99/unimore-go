import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import fixtures from '@/lib/api/mock-fixtures.json';
import type { Leg } from '@/lib/api/types';
import { CalculationNote, RealtimeBox } from './result-notices';

const train = fixtures.demo.response.itineraries[0].legs[1] as Leg;

describe('RealtimeBox', () => {
  it('copia il numero del treno da cercare su ViaggiaTreno', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<RealtimeBox train={train} />);
    expect(screen.getByText(/non in tempo reale/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copia numero' }));
    expect(writeText).toHaveBeenCalledWith('3907');
    expect(screen.getByRole('status')).toHaveTextContent('Numero 3907 copiato.');
    writeText.mockRejectedValueOnce(new Error('negato'));
    await user.click(screen.getByRole('button', { name: 'Copia numero' }));
    expect(screen.getByRole('status')).toHaveTextContent('Copia non riuscita.');
  });

  it('senza treno mostra solo i link e nessun calcolo vuoto', () => {
    const { container } = render(
      <>
        <RealtimeBox />
        <CalculationNote calculation={null} />
      </>,
    );
    expect(screen.queryByRole('button', { name: 'Copia numero' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(container.querySelector('.calc-note')).toBeNull();
  });
});
