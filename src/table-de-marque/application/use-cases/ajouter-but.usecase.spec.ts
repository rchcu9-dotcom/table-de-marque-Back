import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AjouterButUseCase } from './ajouter-but.usecase';
import { MatchLiveEtat } from '../../domain/enums/match-live-etat.enum';
import {
  makeMatchLive,
  makeMatchLiveRepo,
  makeMatchButRepo,
  makeStreamService,
} from './__fixtures__/match-live.fixtures';
import { AjouterButDto } from '../dto/ajouter-but.dto';

const DTO: AjouterButDto = {
  equipeId: 10,
  buteurId: 101,
  tempsJeuSecondes: 300,
};

function makeUseCase(
  liveRepoOverrides: Parameters<typeof makeMatchLiveRepo>[0] = {},
  butRepoOverrides: Parameters<typeof makeMatchButRepo>[0] = {},
) {
  const matchLiveRepo = makeMatchLiveRepo(liveRepoOverrides);
  const matchButRepo = makeMatchButRepo(butRepoOverrides);
  const streamService = makeStreamService();
  const useCase = new AjouterButUseCase(
    matchLiveRepo as any,
    matchButRepo as any,
    streamService as any,
  );
  return { useCase, matchLiveRepo, matchButRepo, streamService };
}

describe('AjouterButUseCase', () => {
  describe('execute()', () => {
    it('crée le but et recalcule le score en EN_PAUSE', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.EN_PAUSE });
      const afterRecompute = makeMatchLive({ etat: MatchLiveEtat.EN_PAUSE, score1Cache: 1 });
      const { useCase, matchButRepo, matchLiveRepo } = makeUseCase(
        {
          findByNumMatch: jest.fn().mockResolvedValue(existing),
          recomputeScore: jest.fn().mockResolvedValue(afterRecompute),
        },
        { create: jest.fn().mockResolvedValue({ id: 1, ...DTO, numMatch: 1, createdAt: new Date() }) },
      );

      const result = await useCase.execute(1, DTO);

      expect(matchButRepo.create).toHaveBeenCalledTimes(1);
      expect(matchLiveRepo.recomputeScore).toHaveBeenCalledWith(1);
      expect(result.score1Cache).toBe(1);
    });

    it('émet un événement SSE avec le nouveau score', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.EN_PAUSE, score1Cache: 0 });
      const afterRecompute = makeMatchLive({ etat: MatchLiveEtat.EN_PAUSE, score1Cache: 2, score2Cache: 1 });
      const { useCase, streamService } = makeUseCase(
        {
          findByNumMatch: jest.fn().mockResolvedValue(existing),
          recomputeScore: jest.fn().mockResolvedValue(afterRecompute),
        },
        { create: jest.fn().mockResolvedValue({ id: 1 }) },
      );

      await useCase.execute(1, DTO);

      expect(streamService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'match-live',
          numMatch: 1,
          score1: 2,
          score2: 1,
        }),
      );
    });

    it('lève NotFoundException si aucun MatchLive n\'existe', async () => {
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(null),
      });

      await expect(useCase.execute(99, DTO)).rejects.toThrow(NotFoundException);
    });

    it('lève BadRequestException si le MatchLive est EN_COURS (but uniquement en pause)', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.EN_COURS });
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
      });

      await expect(useCase.execute(1, DTO)).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si le MatchLive est ANNONCE', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.ANNONCE });
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
      });

      await expect(useCase.execute(1, DTO)).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si le MatchLive est TERMINE (D4)', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.TERMINE });
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
      });

      await expect(useCase.execute(1, DTO)).rejects.toThrow(BadRequestException);
    });
  });
});
