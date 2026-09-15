import { NotFoundException } from '@nestjs/common';
import { DemarrerMatchUseCase } from './demarrer-match.usecase';
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
  const useCase = new DemarrerMatchUseCase(repo as any, etatService, streamService as any);
  return { useCase, repo, streamService };
}

describe('DemarrerMatchUseCase', () => {
  describe('execute()', () => {
    it('passe un MatchLive de ANNONCE à EN_COURS et active le chrono', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.ANNONCE });
      const { useCase, repo } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn().mockImplementation((ml) => Promise.resolve(ml)),
      });

      const result = await useCase.execute(1);

      expect(result.etat).toBe(MatchLiveEtat.EN_COURS);
      expect(result.chronoEnCours).toBe(true);
      expect(result.chronoDerniereMajAt).toBeInstanceOf(Date);
    });

    it('passe un MatchLive de EN_PAUSE à EN_COURS (reprise)', async () => {
      const existing = makeMatchLive({
        etat: MatchLiveEtat.EN_PAUSE,
        tempsEcouleSecondes: 300,
      });
      const { useCase, repo } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn().mockImplementation((ml) => Promise.resolve(ml)),
      });

      const result = await useCase.execute(1);

      expect(result.etat).toBe(MatchLiveEtat.EN_COURS);
      expect(result.chronoEnCours).toBe(true);
      expect(result.tempsEcouleSecondes).toBe(300);
    });

    it('émet un événement SSE match-live après la transition', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.ANNONCE });
      const { useCase, streamService } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn().mockImplementation((ml) => Promise.resolve(ml)),
      });

      await useCase.execute(1);

      expect(streamService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'match-live',
          numMatch: 1,
          etat: MatchLiveEtat.EN_COURS,
          chronoEnCours: true,
        }),
      );
    });

    it('lève NotFoundException si aucun MatchLive n\'existe', async () => {
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(null),
      });

      await expect(useCase.execute(99)).rejects.toThrow(NotFoundException);
    });

    it('lève BadRequestException si le MatchLive est en PLANIFIE', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.PLANIFIE });
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn(),
      });

      await expect(useCase.execute(1)).rejects.toThrow();
    });

    it('lève BadRequestException si le MatchLive est déjà TERMINE (D4)', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.TERMINE });
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn(),
      });

      await expect(useCase.execute(1)).rejects.toThrow();
    });
  });
});
