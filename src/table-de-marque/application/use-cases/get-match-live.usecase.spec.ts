import { GetMatchLiveUseCase } from './get-match-live.usecase';
import { MatchLiveEtat } from '../../domain/enums/match-live-etat.enum';
import {
  makeMatchLive,
  makeMatchLiveRepo,
  makeMatchButRepo,
  makeMatchPenaliteRepo,
  makeMatchBut,
  makeMatchPenalite,
} from './__fixtures__/match-live.fixtures';

function makeUseCase(
  liveRepoOverrides: Parameters<typeof makeMatchLiveRepo>[0] = {},
  butRepoOverrides: Parameters<typeof makeMatchButRepo>[0] = {},
  penaliteRepoOverrides: Parameters<typeof makeMatchPenaliteRepo>[0] = {},
) {
  const matchLiveRepo = makeMatchLiveRepo(liveRepoOverrides);
  const matchButRepo = makeMatchButRepo(butRepoOverrides);
  const matchPenaliteRepo = makeMatchPenaliteRepo(penaliteRepoOverrides);
  const useCase = new GetMatchLiveUseCase(
    matchLiveRepo as any,
    matchButRepo as any,
    matchPenaliteRepo as any,
  );
  return { useCase, matchLiveRepo, matchButRepo, matchPenaliteRepo };
}

describe('GetMatchLiveUseCase', () => {
  describe('execute()', () => {
    it('retourne un MatchLive PLANIFIE par défaut si aucune ligne n\'existe', async () => {
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(null),
      });

      const result = await useCase.execute(1);

      expect(result.matchLive.etat).toBe(MatchLiveEtat.PLANIFIE);
      expect(result.matchLive.numMatch).toBe(1);
      expect(result.matchLive.tempsEcouleSecondes).toBe(0);
      expect(result.matchLive.score1Cache).toBe(0);
      expect(result.matchLive.score2Cache).toBe(0);
      expect(result.buts).toEqual([]);
      expect(result.penalites).toEqual([]);
    });

    it('retourne le MatchLive existant avec ses buts et pénalités', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.EN_PAUSE, score1Cache: 2, score2Cache: 1 });
      const buts = [makeMatchBut({ equipeId: 10 }), makeMatchBut({ id: 2, equipeId: 20 })];
      const { useCase } = makeUseCase(
        { findByNumMatch: jest.fn().mockResolvedValue(existing) },
        { findByNumMatch: jest.fn().mockResolvedValue(buts) },
        { findByNumMatch: jest.fn().mockResolvedValue([]) },
      );

      const result = await useCase.execute(1);

      expect(result.matchLive.etat).toBe(MatchLiveEtat.EN_PAUSE);
      expect(result.buts).toHaveLength(2);
    });

    describe('calcul du flag active des pénalités', () => {
      it('marque une pénalité active si tempsEcoule - tempsJeuDebut < dureeMinutes * 60', async () => {
        // tempsEcouleSecondes = 200, tempsJeuDebut = 100, dureeMinutes = 2 (120s)
        // 200 - 100 = 100 < 120 → active = true
        const existing = makeMatchLive({ etat: MatchLiveEtat.EN_PAUSE, tempsEcouleSecondes: 200 });
        const penalite = makeMatchPenalite({ tempsJeuDebut: 100, dureeMinutes: 2 });
        const { useCase } = makeUseCase(
          { findByNumMatch: jest.fn().mockResolvedValue(existing) },
          { findByNumMatch: jest.fn().mockResolvedValue([]) },
          { findByNumMatch: jest.fn().mockResolvedValue([penalite]) },
        );

        const result = await useCase.execute(1);

        expect(result.penalites[0].active).toBe(true);
      });

      it('marque une pénalité expirée si tempsEcoule - tempsJeuDebut >= dureeMinutes * 60', async () => {
        // tempsEcouleSecondes = 300, tempsJeuDebut = 60, dureeMinutes = 2 (120s)
        // 300 - 60 = 240 >= 120 → active = false
        const existing = makeMatchLive({ etat: MatchLiveEtat.EN_PAUSE, tempsEcouleSecondes: 300 });
        const penalite = makeMatchPenalite({ tempsJeuDebut: 60, dureeMinutes: 2 });
        const { useCase } = makeUseCase(
          { findByNumMatch: jest.fn().mockResolvedValue(existing) },
          { findByNumMatch: jest.fn().mockResolvedValue([]) },
          { findByNumMatch: jest.fn().mockResolvedValue([penalite]) },
        );

        const result = await useCase.execute(1);

        expect(result.penalites[0].active).toBe(false);
      });

      it('marque une pénalité exactement à l\'expiration comme inactive (limite)', async () => {
        // tempsEcouleSecondes = 220, tempsJeuDebut = 100, dureeMinutes = 2 (120s)
        // 220 - 100 = 120 >= 120 → active = false
        const existing = makeMatchLive({ etat: MatchLiveEtat.EN_PAUSE, tempsEcouleSecondes: 220 });
        const penalite = makeMatchPenalite({ tempsJeuDebut: 100, dureeMinutes: 2 });
        const { useCase } = makeUseCase(
          { findByNumMatch: jest.fn().mockResolvedValue(existing) },
          { findByNumMatch: jest.fn().mockResolvedValue([]) },
          { findByNumMatch: jest.fn().mockResolvedValue([penalite]) },
        );

        const result = await useCase.execute(1);

        expect(result.penalites[0].active).toBe(false);
      });
    });
  });
});
