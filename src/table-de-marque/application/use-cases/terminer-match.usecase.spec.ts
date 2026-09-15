import { NotFoundException } from '@nestjs/common';
import { TerminerMatchUseCase } from './terminer-match.usecase';
import { MatchLiveEtatService } from '../services/match-live-etat.service';
import { MatchLiveEtat } from '../../domain/enums/match-live-etat.enum';
import {
  makeMatchLive,
  makeMatchLiveRepo,
  makeStreamService,
} from './__fixtures__/match-live.fixtures';

function makeUseCase(
  repoOverrides: Parameters<typeof makeMatchLiveRepo>[0] = {},
) {
  const repo = makeMatchLiveRepo(repoOverrides);
  const etatService = new MatchLiveEtatService();
  const streamService = makeStreamService();
  const useCase = new TerminerMatchUseCase(repo as any, etatService, streamService as any);
  return { useCase, repo, streamService };
}

describe('TerminerMatchUseCase', () => {
  describe('execute()', () => {
    it('passe un MatchLive de EN_PAUSE à TERMINE', async () => {
      const existing = makeMatchLive({
        etat: MatchLiveEtat.EN_PAUSE,
        tempsEcouleSecondes: 1800,
        score1Cache: 2,
        score2Cache: 1,
      });
      const { useCase, repo } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn().mockImplementation((ml) => Promise.resolve(ml)),
      });

      const result = await useCase.execute(1);

      expect(result.etat).toBe(MatchLiveEtat.TERMINE);
      expect(result.chronoEnCours).toBe(false);
      expect(result.score1Cache).toBe(2);
      expect(result.score2Cache).toBe(1);
    });

    it('émet un événement SSE match-live avec le score figé', async () => {
      const existing = makeMatchLive({
        etat: MatchLiveEtat.EN_PAUSE,
        score1Cache: 3,
        score2Cache: 0,
      });
      const { useCase, streamService } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn().mockImplementation((ml) => Promise.resolve(ml)),
      });

      await useCase.execute(1);

      expect(streamService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'match-live',
          numMatch: 1,
          etat: MatchLiveEtat.TERMINE,
          score1: 3,
          score2: 0,
        }),
      );
    });

    it('lève NotFoundException si aucun MatchLive n\'existe', async () => {
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(null),
      });

      await expect(useCase.execute(99)).rejects.toThrow(NotFoundException);
    });

    it('lève BadRequestException si le MatchLive est en EN_COURS (pas de saut d\'état)', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.EN_COURS });
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn(),
      });

      await expect(useCase.execute(1)).rejects.toThrow();
    });

    it('lève BadRequestException si le MatchLive est déjà TERMINE (D4 — pas de réouverture)', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.TERMINE });
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn(),
      });

      await expect(useCase.execute(1)).rejects.toThrow();
    });
  });
});
