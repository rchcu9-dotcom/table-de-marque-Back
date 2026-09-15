import { MatchLive } from '../../../domain/entities/match-live.entity';
import { MatchBut } from '../../../domain/entities/match-but.entity';
import { MatchPenalite } from '../../../domain/entities/match-penalite.entity';
import { MatchLiveEtat } from '../../../domain/enums/match-live-etat.enum';

export const NOW = new Date('2026-09-04T10:00:00.000Z');

export function makeMatchLive(
  overrides: Partial<{
    numMatch: number;
    etat: MatchLiveEtat;
    tempsEcouleSecondes: number;
    chronoEnCours: boolean;
    chronoDerniereMajAt: Date | null;
    score1Cache: number;
    score2Cache: number;
  }> = {},
): MatchLive {
  return new MatchLive(
    overrides.numMatch ?? 1,
    overrides.etat ?? MatchLiveEtat.PLANIFIE,
    overrides.tempsEcouleSecondes ?? 0,
    overrides.chronoEnCours ?? false,
    overrides.chronoDerniereMajAt ?? null,
    overrides.score1Cache ?? 0,
    overrides.score2Cache ?? 0,
    NOW,
    NOW,
  );
}

export function makeMatchBut(
  overrides: Partial<{
    id: number;
    numMatch: number;
    equipeId: number;
    buteurId: number;
    assist1Id: number | null;
    assist2Id: number | null;
    tempsJeuSecondes: number;
  }> = {},
): MatchBut {
  return new MatchBut(
    overrides.id ?? 1,
    overrides.numMatch ?? 1,
    overrides.equipeId ?? 10,
    overrides.buteurId ?? 100,
    overrides.assist1Id ?? null,
    overrides.assist2Id ?? null,
    overrides.tempsJeuSecondes ?? 120,
    NOW,
  );
}

export function makeMatchPenalite(
  overrides: Partial<{
    id: number;
    numMatch: number;
    equipeId: number;
    joueurId: number;
    typePenaliteCode: string;
    dureeMinutes: number;
    tempsJeuDebut: number;
  }> = {},
): MatchPenalite {
  return new MatchPenalite(
    overrides.id ?? 1,
    overrides.numMatch ?? 1,
    overrides.equipeId ?? 10,
    overrides.joueurId ?? 100,
    overrides.typePenaliteCode ?? 'MIN2',
    overrides.dureeMinutes ?? 2,
    overrides.tempsJeuDebut ?? 60,
    NOW,
  );
}

export function makeMatchLiveRepo(
  overrides: Partial<{
    findByNumMatch: jest.Mock;
    upsert: jest.Mock;
    recomputeScore: jest.Mock;
  }> = {},
) {
  return {
    findByNumMatch:
      overrides.findByNumMatch ?? jest.fn().mockResolvedValue(null),
    upsert:
      overrides.upsert ??
      jest.fn().mockImplementation((ml: MatchLive) => Promise.resolve(ml)),
    recomputeScore:
      overrides.recomputeScore ?? jest.fn().mockResolvedValue(makeMatchLive()),
  };
}

export function makeMatchButRepo(
  overrides: Partial<{
    create: jest.Mock;
    delete: jest.Mock;
    findByNumMatch: jest.Mock;
  }> = {},
) {
  return {
    create: overrides.create ?? jest.fn().mockResolvedValue(makeMatchBut()),
    delete: overrides.delete ?? jest.fn().mockResolvedValue(undefined),
    findByNumMatch: overrides.findByNumMatch ?? jest.fn().mockResolvedValue([]),
  };
}

export function makeMatchPenaliteRepo(
  overrides: Partial<{
    create: jest.Mock;
    delete: jest.Mock;
    findByNumMatch: jest.Mock;
  }> = {},
) {
  return {
    create:
      overrides.create ?? jest.fn().mockResolvedValue(makeMatchPenalite()),
    delete: overrides.delete ?? jest.fn().mockResolvedValue(undefined),
    findByNumMatch: overrides.findByNumMatch ?? jest.fn().mockResolvedValue([]),
  };
}

export function makeStreamService() {
  return {
    emit: jest.fn(),
  };
}
