import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AjouterPenaliteUseCase } from './ajouter-penalite.usecase';
import { MatchLiveEtat } from '../../domain/enums/match-live-etat.enum';
import {
  makeMatchLive,
  makeMatchLiveRepo,
  makeMatchPenaliteRepo,
  makeMatchPenalite,
  makeStreamService,
} from './__fixtures__/match-live.fixtures';
import { AjouterPenaliteDto } from '../dto/ajouter-penalite.dto';

const DTO: AjouterPenaliteDto = {
  equipeId: 10,
  joueurId: 101,
  typePenaliteCode: 'MIN2',
  dureeMinutes: 2,
  tempsJeuDebut: 300,
};

function makeUseCase(
  liveRepoOverrides: Parameters<typeof makeMatchLiveRepo>[0] = {},
  penaliteRepoOverrides: Parameters<typeof makeMatchPenaliteRepo>[0] = {},
) {
  const matchLiveRepo = makeMatchLiveRepo(liveRepoOverrides);
  const matchPenaliteRepo = makeMatchPenaliteRepo(penaliteRepoOverrides);
  const streamService = makeStreamService();
  const useCase = new AjouterPenaliteUseCase(
    matchLiveRepo as any,
    matchPenaliteRepo as any,
    streamService as any,
  );
  return { useCase, matchLiveRepo, matchPenaliteRepo, streamService };
}

describe('AjouterPenaliteUseCase', () => {
  describe('execute()', () => {
    it('crée la pénalité en EN_PAUSE et retourne la pénalité créée', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.EN_PAUSE });
      const penalite = makeMatchPenalite({ typePenaliteCode: 'MIN2', dureeMinutes: 2 });
      const { useCase, matchPenaliteRepo } = makeUseCase(
        { findByNumMatch: jest.fn().mockResolvedValue(existing) },
        { create: jest.fn().mockResolvedValue(penalite) },
      );

      const result = await useCase.execute(1, DTO);

      expect(matchPenaliteRepo.create).toHaveBeenCalledTimes(1);
      expect(matchPenaliteRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          numMatch: 1,
          equipeId: DTO.equipeId,
          joueurId: DTO.joueurId,
          typePenaliteCode: DTO.typePenaliteCode,
          dureeMinutes: DTO.dureeMinutes,
          tempsJeuDebut: DTO.tempsJeuDebut,
        }),
      );
      expect(result.typePenaliteCode).toBe('MIN2');
    });

    it('émet un événement SSE match-live après la création de la pénalité', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.EN_PAUSE, score1Cache: 1, score2Cache: 2 });
      const { useCase, streamService } = makeUseCase(
        { findByNumMatch: jest.fn().mockResolvedValue(existing) },
        { create: jest.fn().mockResolvedValue(makeMatchPenalite()) },
      );

      await useCase.execute(1, DTO);

      expect(streamService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'match-live',
          numMatch: 1,
          score1: 1,
          score2: 2,
        }),
      );
    });

    it('lève NotFoundException si aucun MatchLive n\'existe', async () => {
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(null),
      });

      await expect(useCase.execute(99, DTO)).rejects.toThrow(NotFoundException);
    });

    it('lève BadRequestException si le MatchLive est EN_COURS (pénalité uniquement en pause)', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.EN_COURS });
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
