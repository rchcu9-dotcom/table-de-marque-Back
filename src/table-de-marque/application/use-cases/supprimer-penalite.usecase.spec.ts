import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SupprimerPenaliteUseCase } from './supprimer-penalite.usecase';
import { MatchLiveEtat } from '../../domain/enums/match-live-etat.enum';
import {
  makeMatchLive,
  makeMatchLiveRepo,
  makeMatchPenaliteRepo,
  makeStreamService,
} from './__fixtures__/match-live.fixtures';

function makeUseCase(
  liveRepoOverrides: Parameters<typeof makeMatchLiveRepo>[0] = {},
  penaliteRepoOverrides: Parameters<typeof makeMatchPenaliteRepo>[0] = {},
) {
  const matchLiveRepo = makeMatchLiveRepo(liveRepoOverrides);
  const matchPenaliteRepo = makeMatchPenaliteRepo(penaliteRepoOverrides);
  const streamService = makeStreamService();
  const useCase = new SupprimerPenaliteUseCase(
    matchLiveRepo as any,
    matchPenaliteRepo as any,
    streamService as any,
  );
  return { useCase, matchLiveRepo, matchPenaliteRepo, streamService };
}

describe('SupprimerPenaliteUseCase', () => {
  describe('execute()', () => {
    it('supprime la pénalité en EN_PAUSE', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.EN_PAUSE });
      const { useCase, matchPenaliteRepo } = makeUseCase(
        { findByNumMatch: jest.fn().mockResolvedValue(existing) },
        { delete: jest.fn().mockResolvedValue(undefined) },
      );

      await useCase.execute(1, 42);

      expect(matchPenaliteRepo.delete).toHaveBeenCalledWith(42);
    });

    it('supprime la pénalité en EN_COURS', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.EN_COURS });
      const { useCase, matchPenaliteRepo } = makeUseCase(
        { findByNumMatch: jest.fn().mockResolvedValue(existing) },
        { delete: jest.fn().mockResolvedValue(undefined) },
      );

      await useCase.execute(1, 7);

      expect(matchPenaliteRepo.delete).toHaveBeenCalledWith(7);
    });

    it('émet un événement SSE après la suppression', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.EN_PAUSE, score1Cache: 1, score2Cache: 0 });
      const { useCase, streamService } = makeUseCase(
        { findByNumMatch: jest.fn().mockResolvedValue(existing) },
        { delete: jest.fn().mockResolvedValue(undefined) },
      );

      await useCase.execute(1, 5);

      expect(streamService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'match-live',
          numMatch: 1,
          score1: 1,
          score2: 0,
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
