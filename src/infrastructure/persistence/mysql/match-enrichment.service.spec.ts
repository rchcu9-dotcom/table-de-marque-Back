import { MatchEnrichmentService } from './match-enrichment.service';
import { TaMatchRow } from './match-enrichment.service';

function makeRow(equipe1: string, equipe2: string): TaMatchRow {
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
  };
}

describe('MatchEnrichmentService.inferJ3PouleCode', () => {
  let svc: MatchEnrichmentService;

  beforeEach(() => {
    svc = new MatchEnrichmentService();
  });

  // ── Legacy naming ────────────────────────────────────────────────────────────
  it('returns Or 1 for legacy "Or 1" team name', () => {
    expect(svc.inferJ3PouleCode(makeRow('Or 1 A', 'Or 1 B'))).toBe('Or 1');
  });

  it('returns Argent 1 for legacy "Argent 1" team name', () => {
    expect(svc.inferJ3PouleCode(makeRow('Argent 1 A', 'Argent 1 B'))).toBe('Argent 1');
  });

  // ── Phase 1 — simple slot labels A1/B2/C3/D4 ────────────────────────────────
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

  // ── Phase 2 — bracket entities vXnYm / pXnYm ────────────────────────────────
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

  // ── Non-J3 / unrecognized ────────────────────────────────────────────────────
  it('returns null for unrecognized team names', () => {
    expect(svc.inferJ3PouleCode(makeRow('Meyrin', 'Champigny'))).toBeNull();
    expect(svc.inferJ3PouleCode(makeRow('équipe or', 'autre'))).toBeNull();
  });
});
