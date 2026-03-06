import { GetAteliersUseCase } from '@/application/challenge/use-cases/get-ateliers.usecase';
import { GetChallengeAllUseCase } from '@/application/challenge/use-cases/get-challenge-all.usecase';
import { GetChallengeJ1MomentumUseCase } from '@/application/challenge/use-cases/get-challenge-j1-momentum.usecase';
import { GetChallengeVitesseJ3UseCase } from '@/application/challenge/use-cases/get-challenge-vitesse-j3.usecase';
import { GetClassementAtelierUseCase } from '@/application/challenge/use-cases/get-classement-atelier.usecase';
import { GetClassementGlobalUseCase } from '@/application/challenge/use-cases/get-classement-global.usecase';
import { ChallengeCacheService } from '@/infrastructure/persistence/challenge-cache.service';
import { ChallengeStreamService } from '@/hooks/challenge-stream.service';

describe('ChallengeCacheService', () => {
  const all = { jour1: [], jour3: [], autres: [] };
  const ateliers = [{ id: 'a1', label: 'Vitesse', type: 'vitesse', phase: 'jour 1', ordre: 1 }];
  const classementGlobal = [{ joueurId: 'j1', totalRang: 1, details: [{ atelierId: 'a1', rang: 1 }] }];
  const vitesseJ3 = { slots: { F1: [] }, winnerId: null };

  const buildService = (j1Momentum: Array<{ teamId: string; status: 'planned' | 'ongoing' | 'finished' }>) => {
    const getChallengeAll = { execute: jest.fn().mockResolvedValue(all) } as unknown as GetChallengeAllUseCase;
    const getAteliers = { execute: jest.fn().mockResolvedValue(ateliers) } as unknown as GetAteliersUseCase;
    const getClassementAtelier = { execute: jest.fn().mockResolvedValue([]) } as unknown as GetClassementAtelierUseCase;
    const getClassementGlobal = { execute: jest.fn().mockResolvedValue(classementGlobal) } as unknown as GetClassementGlobalUseCase;
    const getChallengeVitesseJ3 = { execute: jest.fn().mockResolvedValue(vitesseJ3) } as unknown as GetChallengeVitesseJ3UseCase;
    const getChallengeJ1Momentum = {
      execute: jest.fn().mockResolvedValue(
        j1Momentum.map((entry) => ({
          teamId: entry.teamId,
          teamName: `Equipe ${entry.teamId}`,
          teamLogoUrl: null,
          slotStart: new Date('2026-05-24T09:00:00Z'),
          slotEnd: new Date('2026-05-24T09:40:00Z'),
          status: entry.status,
          startedAt: null,
          finishedAt: null,
        })),
      ),
    } as unknown as GetChallengeJ1MomentumUseCase;
    const stream = { emit: jest.fn() } as unknown as ChallengeStreamService;

    const service = new ChallengeCacheService(
      getChallengeAll,
      getAteliers,
      getClassementAtelier,
      getClassementGlobal,
      getChallengeVitesseJ3,
      getChallengeJ1Momentum,
      stream,
    );

    return {
      service,
      getChallengeJ1Momentum: getChallengeJ1Momentum as unknown as { execute: jest.Mock },
      stream: stream as unknown as { emit: jest.Mock },
    };
  };

  it('includes j1Momentum inside challenge snapshot', async () => {
    const { service } = buildService([{ teamId: '10', status: 'planned' }]);

    const snapshot = await service.getSnapshot();

    expect(snapshot.j1Momentum).toHaveLength(1);
    expect(snapshot.j1Momentum[0].teamId).toBe('10');
    expect(snapshot.j1Momentum[0].status).toBe('planned');
  });

  it('emits stream update only on real snapshot change (including j1Momentum changes)', async () => {
    const { service, getChallengeJ1Momentum, stream } = buildService([
      { teamId: '10', status: 'planned' },
    ]);

    await service.refresh(true);
    stream.emit.mockClear();

    const unchanged = await service.refresh(false);
    expect(unchanged.changed).toBe(false);
    expect(stream.emit).not.toHaveBeenCalled();

    getChallengeJ1Momentum.execute.mockResolvedValueOnce([
      {
        teamId: '10',
        teamName: 'Equipe 10',
        teamLogoUrl: null,
        slotStart: new Date('2026-05-24T09:00:00Z'),
        slotEnd: new Date('2026-05-24T09:40:00Z'),
        status: 'ongoing',
        startedAt: new Date('2026-05-24T09:00:00Z'),
        finishedAt: null,
      },
    ]);

    const changed = await service.refresh(false);

    expect(changed.changed).toBe(true);
    expect(stream.emit).toHaveBeenCalledTimes(1);
    expect(stream.emit.mock.calls[0][0]?.snapshot?.j1Momentum?.[0]?.status).toBe(
      'ongoing',
    );
  });
});
