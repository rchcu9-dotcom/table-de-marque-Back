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

  it('returns Or 1 for legacy "Or 1" team name', () => {
    expect(svc.inferJ3PouleCode(makeRow('Or 1 A', 'Or 1 B'))).toBe('Or 1');
  });

  it('returns Argent 1 for legacy "Argent 1" team name', () => {
    expect(svc.inferJ3PouleCode(makeRow('Argent 1 A', 'Argent 1 B'))).toBe(
      'Argent 1',
    );
  });

  it('returns Or 1 for Phase 1 Or match (A vs B)', () => {
    expect(svc.inferJ3PouleCode(makeRow('A1', 'B2'))).toBe('Or 1');
    expect(svc.inferJ3PouleCode(makeRow('B1', 'A2'))).toBe('Or 1');
    expect(svc.inferJ3PouleCode(makeRow('A3', 'B4'))).toBe('Or 1');
    expect(svc.inferJ3PouleCode(makeRow('B3', 'A4'))).toBe('Or 1');
  });

  it('returns Argent 1 for Phase 1 Argent match (C vs D)', () => {
    expect(svc.inferJ3PouleCode(makeRow('C1', 'D2'))).toBe('Argent 1');
    expect(svc.inferJ3PouleCode(makeRow('D1', 'C2'))).toBe('Argent 1');
    expect(svc.inferJ3PouleCode(makeRow('C3', 'D4'))).toBe('Argent 1');
    expect(svc.inferJ3PouleCode(makeRow('D3', 'C4'))).toBe('Argent 1');
  });

  it('returns Or 1 for Phase 2 Or winner match (vA / vB)', () => {
    expect(svc.inferJ3PouleCode(makeRow('vA1B2', 'vB1A2'))).toBe('Or 1');
    expect(svc.inferJ3PouleCode(makeRow('vA3B4', 'vB3A4'))).toBe('Or 1');
  });

  it('returns Argent 1 for Phase 2 Argent winner match (vC / vD)', () => {
    expect(svc.inferJ3PouleCode(makeRow('vC1D2', 'vD1C2'))).toBe('Argent 1');
    expect(svc.inferJ3PouleCode(makeRow('vC3D4', 'vD3C4'))).toBe('Argent 1');
  });

  it('returns Or 1 for Phase 2 Or loser match (pA / pB)', () => {
    expect(svc.inferJ3PouleCode(makeRow('pA1B2', 'pB1A2'))).toBe('Or 1');
    expect(svc.inferJ3PouleCode(makeRow('pA3B4', 'pB3A4'))).toBe('Or 1');
  });

  it('returns Argent 1 for Phase 2 Argent loser match (pC / pD)', () => {
    expect(svc.inferJ3PouleCode(makeRow('pC1D2', 'pD1C2'))).toBe('Argent 1');
    expect(svc.inferJ3PouleCode(makeRow('pC3D4', 'pD3C4'))).toBe('Argent 1');
  });

  it('returns null for unrecognized team names outside the J3 bracket', () => {
    expect(
      svc.inferJ3PouleCode(makeRow('Meyrin', 'Champigny', { NUM_MATCH: 10 })),
    ).toBeNull();
    expect(
      svc.inferJ3PouleCode(makeRow('Equipe or', 'autre', { NUM_MATCH: 10 })),
    ).toBeNull();
  });

  it('returns E/F/G/H from J3 match numbers even when team names are resolved', () => {
    expect(
      svc.inferJ3PouleCode(makeRow('Champigny', 'Tours', { NUM_MATCH: 53 })),
    ).toBe('E');
    expect(
      svc.inferJ3PouleCode(makeRow('Meyrin', 'Aulnay', { NUM_MATCH: 56 })),
    ).toBe('F');
    expect(
      svc.inferJ3PouleCode(makeRow('Bordeaux', 'Rouen', { NUM_MATCH: 61 })),
    ).toBe('G');
    expect(
      svc.inferJ3PouleCode(makeRow('Caen', 'Nantes', { NUM_MATCH: 64 })),
    ).toBe('F');
  });
});
