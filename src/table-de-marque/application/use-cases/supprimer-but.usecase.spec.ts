import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SupprimerButUseCase } from './supprimer-but.usecase';
import { MatchLiveEtat } from '../../domain/enums/match-live-etat.enum';
import {
  makeMatchLive,
  makeMatchLiveRepo,
  makeMatchButRepo,
  makeStreamService,
} from './__fixtures__/match-live.fixtures';

function makeUseCase(
  liveRepoOverrides: Parameters<typeof makeMatchLiveRepo>[0] = {},
  butRepoOverrides: Parameters<typeof makeMatchButRepo>[0] = {},
) {
  const matchLiveRepo = makeMatchLiveRepo(liveRepoOverrides);
  const matchButRepo = makeMatchButRepo(butRepoOverrides);
  const streamService = makeStreamService();
  const useCase = new SupprimerButUseCase(
    matchLiveRepo as any,
    matchButRepo as any,
    streamService as any,
  );
  return { useCase, matchLiveRepo, matchButRepo, streamService };
}

describe('SupprimerButUseCase', () => {
  describe('execute()', () => {
    it('supprime le but et recalcule le score en EN_PAUSE', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.EN_PAUSE, score1Cache: 2 });
      const afterRecompute = makeMatchLive({ etat: MatchLiveEtat.EN_PAUSE, score1Cache: 1 });
      const { useCase, matchButRepo, matchLiveRepo } = makeUseCase(
        {
          findByNumMatch: jest.fn().mockResolvedValue(existing),
          recomputeScore: jest.fn().mockResolvedValue(afterRecompute),
        },
        { delete: jest.fn().mockResolvedValue(undefined) },
      );

      const result = await useCase.execute(1, 42);

      expect(matchButRepo.delete).toHaveBeenCalledWith(42);
      expect(matchLiveRepo.recomputeScore).toHaveBeenCalledWith(1);
      expect(result.score1Cache).toBe(1);
    });

    it('supprime le but et recalcule le score en EN_COURS', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.EN_COURS, score2Cache: 1 });
      const afterRecompute = makeMatchLive({ etat: MatchLiveEtat.EN_COURS, score2Cache: 0 });
      const { useCase, matchButRepo } = makeUseCase(
        {
          findByNumMatch: jest.fn().mockResolvedValue(existing),
          recomputeScore: jest.fn().mockResolvedValue(afterRecompute),
        },
        { delete: jest.fn().mockResolvedValue(undefined) },
      );

      await useCase.execute(1, 7);

      expect(matchButRepo.delete).toHaveBeenCalledWith(7);
    });

    it('émet un événement SSE avec le score mis à jour', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.EN_PAUSE, score1Cache: 3 });
      const afterRecompute = makeMatchLive({ etat: MatchLiveEtat.EN_PAUSE, score1Cache: 2, score2Cache: 1 });
      const { useCase, streamService } = makeUseCase(
        {
          findByNumMatch: jest.fn().mockResolvedValue(existing),
          recomputeScore: jest.fn().mockResolvedValue(afterRecompute),
        },
        { delete: jest.fn().mockResolvedValue(undefined) },
      );

      await useCase.execute(1, 5);

      expect(streamService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'match-live',
          score1: 2,
          score2: 1,
        }),
      );
    });

    it('lève NotFoundException si aucun MatchLive n\'existe', async () => {
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(null),
      });

      await expect(useCase.execute(99, 1)).rejects.toThrow(NotFoundException);
    });

    it('lève BadRequestException si le MatchLive est TERMINE (D4 — pas de correction a posteriori)', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.TERMINE });
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
      });

      await expect(useCase.execute(1, 1)).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si le MatchLive est ANNONCE', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.ANNONCE });
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
      });

      await expect(useCase.execute(1, 1)).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si le MatchLive est PLANIFIE', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.PLANIFIE });
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
      });

      await expect(useCase.execute(1, 1)).rejects.toThrow(BadRequestException);
    });
  });
});
