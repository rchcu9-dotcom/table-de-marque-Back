import { MatchEnrichmentService } from './match-enrichment.service';
import type { TaMatchRow } from './match-enrichment.service';

function makeRow(
  equipe1: string,
  equipe2: string,
  overrides?: Partial<TaMatchRow>,
): TaMatchRow {
  return {
    NUM_MATCH: 50,
    MATCH_CASE: 1,
    EQUIPE1: equipe1,
    EQUIPE2: equipe2,
    EQUIPE_ID1: null,
    EQUIPE_ID2: null,
    SCORE1: null,
    SCORE2: null,
    ECART: null,
    ETAT: '',
    DATEHEURE_SQL: '2026-05-25 09:00:00',
    SURFACAGE: 0,
    ...overrides,
  };
}

describe('MatchEnrichmentService.inferJ3PouleCode', () => {
  let svc: MatchEnrichmentService;

  beforeEach(() => {
    svc = new MatchEnrichmentService();
  });

  it('supports the primary J3 naming from TA_MATCHS', () => {
    expect(
      svc.inferJ3PouleCode(makeRow('Perd. G3-H4', 'Perd. G4-H3')),
    ).toBe('L');
    expect(
      svc.inferJ3PouleCode(makeRow('Vain. E2-F1', 'Vain. E1-F2')),
    ).toBe('I');
  });

  it('keeps legacy p.../v... aliases as fallback', () => {
    expect(svc.inferJ3PouleCode(makeRow('pG3H4', 'pG4H3'))).toBe('L');
    expect(svc.inferJ3PouleCode(makeRow('vE2F1', 'vE1F2'))).toBe('I');
  });

  it('maps J3 phase 1 seed matches to I/J/K/L', () => {
    expect(svc.inferJ3PouleCode(makeRow('G4', 'H3'))).toBe('L');
    expect(svc.inferJ3PouleCode(makeRow('G2', 'H1'))).toBe('J');
    expect(svc.inferJ3PouleCode(makeRow('E4', 'F3'))).toBe('K');
    expect(svc.inferJ3PouleCode(makeRow('E3', 'F4'))).toBe('K');
    expect(svc.inferJ3PouleCode(makeRow('G1', 'H2'))).toBe('J');
    expect(svc.inferJ3PouleCode(makeRow('E1', 'F2'))).toBe('I');
  });

  it('falls back to match numbers when team names are already resolved', () => {
    expect(
      svc.inferJ3PouleCode(makeRow('Champigny', 'Tours', { NUM_MATCH: 62 })),
    ).toBe('L');
    expect(
      svc.inferJ3PouleCode(makeRow('Bordeaux', 'Rouen', { NUM_MATCH: 63 })),
    ).toBe('K');
    expect(
      svc.inferJ3PouleCode(makeRow('Meyrin', 'Aulnay', { NUM_MATCH: 76 })),
    ).toBe('J');
    expect(
      svc.inferJ3PouleCode(makeRow('Caen', 'Nantes', { NUM_MATCH: 81 })),
    ).toBe('I');
  });
});
