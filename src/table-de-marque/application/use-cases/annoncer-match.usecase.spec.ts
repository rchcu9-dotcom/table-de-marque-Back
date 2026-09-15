import { NotFoundException } from '@nestjs/common';
import { AnnoncerMatchUseCase } from './annoncer-match.usecase';
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
  const useCase = new AnnoncerMatchUseCase(repo as any, etatService, streamService as any);
  return { useCase, repo, streamService };
}

describe('AnnoncerMatchUseCase', () => {
  describe('execute()', () => {
    it('crée un MatchLive en ANNONCE quand aucun n\'existe (PLANIFIE implicite)', async () => {
      const { useCase, repo, streamService } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation((ml) => Promise.resolve(ml)),
      });

      const result = await useCase.execute(1);

      expect(result.etat).toBe(MatchLiveEtat.ANNONCE);
      expect(repo.upsert).toHaveBeenCalledTimes(1);
    });

    it('passe un MatchLive existant de PLANIFIE à ANNONCE', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.PLANIFIE });
      const { useCase, repo, streamService } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn().mockImplementation((ml) => Promise.resolve(ml)),
      });

      const result = await useCase.execute(1);

      expect(result.etat).toBe(MatchLiveEtat.ANNONCE);
      expect(repo.upsert).toHaveBeenCalledTimes(1);
    });

    it('émet un événement SSE match-live après la transition', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.PLANIFIE });
      const { useCase, streamService } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn().mockImplementation((ml) => Promise.resolve(ml)),
      });

      await useCase.execute(1);

      expect(streamService.emit).toHaveBeenCalledTimes(1);
      expect(streamService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'match-live',
          numMatch: 1,
          etat: MatchLiveEtat.ANNONCE,
        }),
      );
    });

    it('lève BadRequestException si le MatchLive est déjà en ANNONCE', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.ANNONCE });
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn(),
      });

      await expect(useCase.execute(1)).rejects.toThrow();
    });

    it('lève BadRequestException si le MatchLive est TERMINE (D4)', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.TERMINE });
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn(),
      });

      await expect(useCase.execute(1)).rejects.toThrow();
    });
  });
});
