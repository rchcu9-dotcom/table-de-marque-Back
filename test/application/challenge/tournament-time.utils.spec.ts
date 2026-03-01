import {
  buildTournamentDateTimeIso,
  buildTournamentDateTimeMs,
} from '../../../src/application/shared/tournament-time.utils';

describe('tournament-time.utils', () => {
  it('construit un datetime Paris correct en hiver pour 09:48', () => {
    const iso = buildTournamentDateTimeIso('2026-03-02', '09:48');

    expect(iso).toBe('2026-03-02T09:48:00+01:00');
    expect(new Date(iso!).toISOString()).toBe('2026-03-02T08:48:00.000Z');
  });

  it('construit un datetime Paris correct en ete avec offset +02:00', () => {
    const iso = buildTournamentDateTimeIso('2026-06-15', '09:48');

    expect(iso).toBe('2026-06-15T09:48:00+02:00');
    expect(new Date(iso!).toISOString()).toBe('2026-06-15T07:48:00.000Z');
  });

  it('garde buildTournamentDateTimeMs coherent avec l ISO Paris genere', () => {
    const iso = buildTournamentDateTimeIso('2026-03-02', '11:56');
    const ms = buildTournamentDateTimeMs('2026-03-02', '11:56');

    expect(ms).toBe(new Date('2026-03-02T11:56:00+01:00').getTime());
    expect(new Date(ms).toISOString()).toBe(new Date(iso!).toISOString());
  });
});
