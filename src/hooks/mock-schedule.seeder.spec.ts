import { validate, version } from 'uuid';
import type { Joueur } from '@/domain/joueur/entities/joueur.entity';
import type { JoueurRepository } from '@/domain/joueur/repositories/joueur.repository';
import type { Match } from '@/domain/match/entities/match.entity';
import type { MatchRepository } from '@/domain/match/repositories/match.repository';
import { MockScheduleSeeder } from './mock-schedule.seeder';

describe('MockScheduleSeeder', () => {
  const variablesInitiales = { ...process.env };
  let matchs: Match[];
  let joueurs: Joueur[];
  let seeder: MockScheduleSeeder;

  beforeEach(() => {
    matchs = [];
    joueurs = [];
    delete process.env.MATCH_REPOSITORY_DRIVER;
    process.env.USE_MOCK_SCHEDULE = 'true';
    seeder = new MockScheduleSeeder(
      {
        create: (match: Match) => {
          matchs.push(match);
          return Promise.resolve(match);
        },
      } as unknown as MatchRepository,
      {
        create: (joueur: Joueur) => {
          joueurs.push(joueur);
          return Promise.resolve(joueur);
        },
      } as unknown as JoueurRepository,
    );
  });

  afterAll(() => {
    process.env = variablesInitiales;
  });

  it('donne un UUID v4 valide et unique à chaque match (critère 12)', async () => {
    await seeder.onModuleInit();

    const ids = matchs.map((m) => m.id);

    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id) => !validate(id) || version(id) !== 4)).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('donne un UUID v4 valide et unique à chaque joueur (critère 12)', async () => {
    await seeder.onModuleInit();

    const ids = joueurs.map((j) => j.id);

    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id) => !validate(id) || version(id) !== 4)).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ne génère rien sans USE_MOCK_SCHEDULE', async () => {
    delete process.env.USE_MOCK_SCHEDULE;

    await seeder.onModuleInit();

    expect(matchs).toEqual([]);
    expect(joueurs).toEqual([]);
  });

  it('ne génère rien hors du dépôt mémoire', async () => {
    process.env.MATCH_REPOSITORY_DRIVER = 'mysql';

    await seeder.onModuleInit();

    expect(matchs).toEqual([]);
  });
});
