import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomeLocationField, shortLabel } from './home-location-field';

const NOMINATIM_LABEL = '12, Via Emilia Ovest, San Faustino, Modena, Emilia-Romagna, 41123, Italia';

function setup(overrides: Partial<Parameters<typeof HomeLocationField>[0]> = {}) {
  const props = {
    home: null,
    onChange: vi.fn(),
    onSearch: vi.fn().mockResolvedValue([{ label: NOMINATIM_LABEL, lat: 44.65, lon: 10.9 }]),
    onPickOnMap: vi.fn(),
    picking: false,
    ...overrides,
  };
  render(<HomeLocationField {...props} />);
  return props;
}

afterEach(() => vi.unstubAllGlobals());

describe('shortLabel', () => {
  it('accorcia le etichette Nominatim mantenendo via, civico e città', () => {
    expect(shortLabel(NOMINATIM_LABEL)).toBe('Via Emilia Ovest 12, Modena');
    expect(shortLabel('Piazza Grande, Centro, Modena, Emilia-Romagna')).toBe(
      'Piazza Grande, Centro, Modena',
    );
    expect(shortLabel('Modena, Italia')).toBe('Modena, Italia');
    // Place name before the house number keeps the street (live Nominatim shape).
    expect(
      shortLabel(
        "Questura/RPC, 10, Via Emilia San Pietro, Centro Storico, Reggio nell'Emilia, Emilia-Romagna, 42121, Italia",
      ),
    ).toBe("Questura/RPC, Via Emilia San Pietro 10, Reggio nell'Emilia");
  });
});

describe('HomeLocationField', () => {
  it('cerca con Invio e sceglie un risultato', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.type(screen.getByLabelText('Indirizzo di casa'), 'Via Emilia Ovest 12{Enter}');
    expect(props.onSearch).toHaveBeenCalledWith('Via Emilia Ovest 12');
    await user.click(await screen.findByRole('button', { name: 'Via Emilia Ovest 12, Modena' }));
    expect(props.onChange).toHaveBeenCalledWith({
      label: 'Via Emilia Ovest 12, Modena',
      lat: 44.65,
      lon: 10.9,
    });
  });

  it('spiega query troppo corte, nessun risultato ed errori del servizio', async () => {
    const user = userEvent.setup();
    const onSearch = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('Servizio indirizzi non disponibile'));
    setup({ onSearch });
    const input = screen.getByLabelText('Indirizzo di casa');
    await user.type(input, 'ab');
    await user.click(screen.getByRole('button', { name: 'Cerca indirizzo' }));
    expect(screen.getByRole('alert')).toHaveTextContent('almeno 3 caratteri');
    await user.type(input, 'cdef');
    await user.click(screen.getByRole('button', { name: 'Cerca indirizzo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nessun indirizzo trovato');
    await user.click(screen.getByRole('button', { name: 'Cerca indirizzo' }));
    expect(await screen.findByText('Servizio indirizzi non disponibile')).toBeInTheDocument();
  });

  it('usa la posizione del dispositivo o la mappa', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 44.7, longitude: 10.63 } } as GeolocationPosition),
      },
    });
    const props = setup();
    await user.click(screen.getByRole('button', { name: /La mia posizione/ }));
    expect(props.onChange).toHaveBeenCalledWith({
      label: 'La mia posizione',
      lat: 44.7,
      lon: 10.63,
    });
    await user.click(screen.getByRole('button', { name: /Scegli sulla mappa/ }));
    expect(props.onPickOnMap).toHaveBeenCalledOnce();
  });

  it('mostra la casa scelta e permette di cambiarla', async () => {
    const user = userEvent.setup();
    const props = setup({ home: { label: 'Via Emilia 1', lat: 1, lon: 2 } });
    expect(screen.getByText('Via Emilia 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cambia indirizzo di casa' }));
    expect(props.onChange).toHaveBeenCalledWith(null);
  });
});
