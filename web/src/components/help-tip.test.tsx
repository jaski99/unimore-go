import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { HelpTip } from './help-tip';

describe('HelpTip', () => {
  it('si apre al tocco, si legge ad alta voce e si chiude con Esc o clic fuori', async () => {
    const user = userEvent.setup();
    render(
      <>
        <HelpTip label="Anticipo">Minuti in sede prima della lezione.</HelpTip>
        <p>fuori</p>
      </>,
    );
    const button = screen.getByRole('button', { name: 'Che cos’è: Anticipo' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Minuti in sede prima della lezione.')).not.toBeInTheDocument();
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Minuti in sede prima della lezione.');
    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    await user.click(screen.getByText('fuori'));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
