import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EditerChronoUseCase } from './editer-chrono.usecase';
import { MatchLiveEtat } from '../../domain/enums/match-live-etat.enum';
import {
  makeMatchLive,
  makeMatchLiveRepo,
  makeStreamService,
} from './__fixtures__/match-live.fixtures';
import { EditerChronoDto } from '../dto/editer-chrono.dto';

function makeUseCase(
  repoOverrides: Parameters<typeof makeMatchLiveRepo>[0] = {},
) {
  const repo = makeMatchLiveRepo(repoOverrides);
  const streamService = makeStreamService();
  const useCase = new EditerChronoUseCase(repo as any, streamService as any);
  return { useCase, repo, streamService };
}

describe('EditerChronoUseCase', () => {
  describe('execute()', () => {
    it('met à jour tempsEcouleSecondes en EN_PAUSE', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.EN_PAUSE, tempsEcouleSecondes: 300 });
      const dto: EditerChronoDto = { tempsEcouleSecondes: 420 };
      const { useCase, repo } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn().mockImplementation((ml) => Promise.resolve(ml)),
      });

      const result = await useCase.execute(1, dto);

      expect(result.tempsEcouleSecondes).toBe(420);
      expect(result.chronoEnCours).toBe(false);
      expect(repo.upsert).toHaveBeenCalledTimes(1);
    });

    it('émet un événement SSE avec les nouvelles valeurs du chrono', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.EN_PAUSE, tempsEcouleSecondes: 100 });
      const dto: EditerChronoDto = { tempsEcouleSecondes: 200 };
      const { useCase, streamService } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn().mockImplementation((ml) => Promise.resolve(ml)),
      });

      await useCase.execute(1, dto);

      expect(streamService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'match-live',
          numMatch: 1,
          tempsEcouleSecondes: 200,
          chronoEnCours: false,
        }),
      );
    });

    it('lève NotFoundException si aucun MatchLive n\'existe', async () => {
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(null),
      });

      await expect(
        useCase.execute(99, { tempsEcouleSecondes: 100 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève BadRequestException si le MatchLive est EN_COURS (chrono non éditable en cours)', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.EN_COURS });
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn(),
      });

      await expect(
        useCase.execute(1, { tempsEcouleSecondes: 100 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si le MatchLive est ANNONCE', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.ANNONCE });
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn(),
      });

      await expect(
        useCase.execute(1, { tempsEcouleSecondes: 100 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si le MatchLive est TERMINE (D4)', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.TERMINE });
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn(),
      });

      await expect(
        useCase.execute(1, { tempsEcouleSecondes: 100 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
