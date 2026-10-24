import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import fixtures from '@/lib/api/mock-fixtures.json';
import type { PlanService } from '@/lib/api/plan-service';
import type { PlanResponse } from '@/lib/api/types';
import { defaultPlannerValues } from '@/lib/plan-request';
import { LocalStorageScheduleStore } from '@/lib/schedule-store';
import { memoryStorage } from '@/test/memory-storage';
import { nextLessonRequest, SchedulePanel } from './schedule-panel';

const values = defaultPlannerValues(new Date('2026-10-26T06:00:00Z'));
const lesson = { campusId: 'dief', date: '2026-10-28', time: '10:00' };

describe('nextLessonRequest', () => {
  it('usa le impostazioni dell’utente invece di valori fissi', () => {
    const request = nextLessonRequest(
      {
        ...values,
        direction: 'return',
        mode: 'walk',
        stationBufferMin: 9,
        regionalOnly: false,
        originKind: 'home',
        home: { label: 'Casa', lat: 44.7, lon: 10.63 },
      },
      lesson,
    );
    expect(request).toMatchObject({
      origin: { lat: 44.7, lon: 10.63 },
      arrive_by: '2026-10-28T10:00:00+01:00',
      mode: 'walk',
      station_buffer_min: 9,
      train_categories: ['regional', 'intercity', 'high_speed'],
    });
  });

  it('non calcola nulla se mancano i dati di casa', () => {
    expect(nextLessonRequest({ ...values, originKind: 'home' }, lesson)).toBeNull();
  });
});

describe('SchedulePanel', () => {
  it('mostra quando uscire per la prossima lezione e la riporta nel modulo', async () => {
    const user = userEvent.setup();
    const store = new LocalStorageScheduleStore(memoryStorage());
    store.add({ weekday: 1, time: '08:30', campusId: 'dief' });
    const createPlan = vi.fn().mockResolvedValue(fixtures.demo.response as PlanResponse);
    const service = { createPlan } as unknown as PlanService;
    const onSelectClass = vi.fn();
    render(
      <SchedulePanel
        store={store}
        campuses={fixtures.campuses}
        values={{ ...values, mode: 'walk' }}
        service={service}
        onSelectClass={onSelectClass}
      />,
    );
    expect(await screen.findByText('07:39')).toBeInTheDocument();
    expect(createPlan).toHaveBeenCalledWith(expect.objectContaining({ mode: 'walk' }));
    await user.click(screen.getByRole('button', { name: /Dipartimento di Ingegneria/ }));
    expect(onSelectClass).toHaveBeenCalledWith(
      expect.objectContaining({ campusId: 'dief', time: '08:30' }),
    );
  });

  it('aggiunge e rimuove lezioni', async () => {
    const user = userEvent.setup();
    const store = new LocalStorageScheduleStore(memoryStorage());
    render(
      <SchedulePanel
        store={store}
        campuses={fixtures.campuses}
        values={values}
        service={
          {
            createPlan: vi.fn().mockResolvedValue({ itineraries: [], warnings: [] }),
          } as unknown as PlanService
        }
        onSelectClass={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Aggiungi lezione/ }));
    expect(store.getAll()).toHaveLength(1);
    expect(await screen.findByText('nessun treno trovato', { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Rimuovi lezione/ }));
    expect(store.getAll()).toHaveLength(0);
  });
});
