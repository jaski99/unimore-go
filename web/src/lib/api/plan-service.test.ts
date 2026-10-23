import { describe, expect, it } from 'vitest';
import { createPlanService, HttpPlanService, MockPlanService } from './plan-service';

describe('createPlanService', () => {
  it('usa il client HTTP salvo richiesta esplicita del mock', () => {
    expect(createPlanService({ apiUrl: 'http://localhost:8000', useMock: false })).toBeInstanceOf(
      HttpPlanService,
    );
    expect(createPlanService({ apiUrl: 'http://localhost:8000', useMock: true })).toBeInstanceOf(
      MockPlanService,
    );
  });
});
