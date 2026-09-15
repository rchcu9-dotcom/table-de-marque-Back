import { NotFoundException } from '@nestjs/common';
import { PauserMatchUseCase } from './pauser-match.usecase';
import { MatchLiveEtatService } from '../services/match-live-etat.service';
import { MatchLiveEtat } from '../../domain/enums/match-live-etat.enum';
import {
  makeMatchLive,
  makeMatchLiveRepo,
  makeStreamService,
  NOW,
} from './__fixtures__/match-live.fixtures';

function makeUseCase(
  repoOverrides: Parameters<typeof makeMatchLiveRepo>[0] = {},
) {
  const repo = makeMatchLiveRepo(repoOverrides);
  const etatService = new MatchLiveEtatService();
  const streamService = makeStreamService();
  const useCase = new PauserMatchUseCase(repo as any, etatService, streamService as any);
  return { useCase, repo, streamService };
}

describe('PauserMatchUseCase', () => {
  describe('execute()', () => {
    it('passe un MatchLive de EN_COURS à EN_PAUSE et arrête le chrono', async () => {
      const majAt = new Date('2026-09-04T09:59:50.000Z');
      const existing = makeMatchLive({
        etat: MatchLiveEtat.EN_COURS,
        tempsEcouleSecondes: 100,
        chronoEnCours: true,
        chronoDerniereMajAt: majAt,
      });
      const { useCase, repo } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn().mockImplementation((ml) => Promise.resolve(ml)),
      });

      const result = await useCase.execute(1);

      expect(result.etat).toBe(MatchLiveEtat.EN_PAUSE);
      expect(result.chronoEnCours).toBe(false);
      // tempsEcouleSecondes >= 100 (accumule les secondes depuis majAt)
      expect(result.tempsEcouleSecondes).toBeGreaterThanOrEqual(100);
    });

    it('préserve tempsEcouleSecondes si le chrono n\'était pas en cours', async () => {
      const existing = makeMatchLive({
        etat: MatchLiveEtat.EN_COURS,
        tempsEcouleSecondes: 250,
        chronoEnCours: false,
        chronoDerniereMajAt: null,
      });
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn().mockImplementation((ml) => Promise.resolve(ml)),
      });

      const result = await useCase.execute(1);

      expect(result.tempsEcouleSecondes).toBe(250);
    });

    it('émet un événement SSE match-live après la transition', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.EN_COURS, chronoEnCours: true, chronoDerniereMajAt: NOW });
      const { useCase, streamService } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn().mockImplementation((ml) => Promise.resolve(ml)),
      });

      await useCase.execute(1);

      expect(streamService.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'match-live',
          numMatch: 1,
          etat: MatchLiveEtat.EN_PAUSE,
          chronoEnCours: false,
        }),
      );
    });

    it('lève NotFoundException si aucun MatchLive n\'existe', async () => {
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(null),
      });

      await expect(useCase.execute(99)).rejects.toThrow(NotFoundException);
    });

    it('lève BadRequestException si le MatchLive est en ANNONCE', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.ANNONCE });
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn(),
      });

      await expect(useCase.execute(1)).rejects.toThrow();
    });

    it('lève BadRequestException si le MatchLive est TERMINE', async () => {
      const existing = makeMatchLive({ etat: MatchLiveEtat.TERMINE });
      const { useCase } = makeUseCase({
        findByNumMatch: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn(),
      });

      await expect(useCase.execute(1)).rejects.toThrow();
    });
  });
});
