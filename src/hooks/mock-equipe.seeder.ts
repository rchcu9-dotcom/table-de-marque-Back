import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { EQUIPE_REPOSITORY, EquipeRepository } from '@/domain/equipe/repositories/equipe.repository';
import { Equipe, PouleClassement } from '@/domain/equipe/entities/equipe.entity';
import { MOCK_TEAMS } from './mock-teams.data';

@Injectable()
export class MockEquipeSeeder implements OnModuleInit {
  private readonly logger = new Logger(MockEquipeSeeder.name);

  constructor(
    @Inject(EQUIPE_REPOSITORY)
    private readonly equipeRepo: EquipeRepository,
  ) {}

  async onModuleInit() {
    const useMock = (process.env.USE_MOCK_SCHEDULE ?? '').toLowerCase() === 'true';
    const driver = (process.env.EQUIPE_REPOSITORY_DRIVER ?? '').toLowerCase();

    if (!useMock) {
      this.logger.debug('Mock equipe seeding skipped (USE_MOCK_SCHEDULE is not true).');
      return;
    }

    if (driver && driver !== 'memory') {
      this.logger.warn('Mock equipe seeding skipped: EQUIPE_REPOSITORY_DRIVER is not memory.');
      return;
    }

    const seeder = this.equipeRepo as any;
    if (typeof seeder.clear === 'function') {
      seeder.clear();
    }

    const pouleBuckets: Record<string, PouleClassement> = {
      A: { pouleCode: 'A', pouleName: 'Poule A', equipes: [], phase: 'Brassage' },
      B: { pouleCode: 'B', pouleName: 'Poule B', equipes: [], phase: 'Brassage' },
      C: { pouleCode: 'C', pouleName: 'Poule C', equipes: [], phase: 'Brassage' },
      D: { pouleCode: 'D', pouleName: 'Poule D', equipes: [], phase: 'Brassage' },
      Alpha: { pouleCode: 'Alpha', pouleName: 'Tournoi Or - Alpha', equipes: [], phase: 'Qualification' },
      Beta: { pouleCode: 'Beta', pouleName: 'Tournoi Or - Beta', equipes: [], phase: 'Qualification' },
      Gamma: { pouleCode: 'Gamma', pouleName: 'Tournoi Argent - Gamma', equipes: [], phase: 'Qualification' },
      Delta: { pouleCode: 'Delta', pouleName: 'Tournoi Argent - Delta', equipes: [], phase: 'Qualification' },
      Or1: { pouleCode: 'Or1', pouleName: 'Carre Or 1', equipes: [], phase: 'Finales' },
      Argent1: { pouleCode: 'Argent1', pouleName: 'Carre Argent 1', equipes: [], phase: 'Finales' },
      Or5: { pouleCode: 'Or5', pouleName: 'Carre Or 5', equipes: [], phase: 'Finales' },
      Argent5: { pouleCode: 'Argent5', pouleName: 'Carre Argent 5', equipes: [], phase: 'Finales' },
    };

    const assignPoule = (index: number): keyof typeof pouleBuckets => {
      if (index < 4) return 'A';
      if (index < 8) return 'B';
      if (index < 12) return 'C';
      return 'D';
    };

    // Brassage A-D
    MOCK_TEAMS.forEach((team, idx) => {
      const pouleCode = assignPoule(idx);
      const poule = pouleBuckets[pouleCode];
      const rang = poule.equipes.length + 1;
      poule.equipes.push(
        new Equipe(
          team.id,
          team.name,
          team.logo,
          pouleCode,
          poule.pouleName,
          rang,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
        ),
      );
    });

    // Qualification : Alpha/Beta/Gamma/Delta en fonction des rangs Brassage
    const pouleA = pouleBuckets.A.equipes;
    const pouleB = pouleBuckets.B.equipes;
    const pouleC = pouleBuckets.C.equipes;
    const pouleD = pouleBuckets.D.equipes;

    const alphaTeams = [pouleA[0], pouleA[1], pouleB[0], pouleB[1]];
    const betaTeams = [pouleC[0], pouleC[1], pouleD[0], pouleD[1]];
    const gammaTeams = [pouleA[2], pouleA[3], pouleB[2], pouleB[3]];
    const deltaTeams = [pouleC[2], pouleC[3], pouleD[2], pouleD[3]];

    const fillPoule = (code: keyof typeof pouleBuckets, teams: Equipe[]) => {
      const target = pouleBuckets[code];
      teams.forEach((t, idx) => {
        target.equipes.push(
          new Equipe(
            t.id,
            t.name,
            t.logoUrl,
            target.pouleCode,
            target.pouleName,
            idx + 1,
            0,
            0,
            0,
            0,
            Math.max(0, 8 - idx * 2), // points arbitraires décroissants
            0,
            0,
            0,
          ),
        );
      });
    };

    fillPoule('Alpha', alphaTeams);
    fillPoule('Beta', betaTeams);
    fillPoule('Gamma', gammaTeams);
    fillPoule('Delta', deltaTeams);

    // Finales : carrés Or/Argent (Or1/Argent1/Or5/Argent5)
    const or1Teams = [pouleBuckets.Alpha.equipes[0], pouleBuckets.Alpha.equipes[1], pouleBuckets.Beta.equipes[0], pouleBuckets.Beta.equipes[1]];
    const or5Teams = [pouleBuckets.Alpha.equipes[2], pouleBuckets.Alpha.equipes[3], pouleBuckets.Beta.equipes[2], pouleBuckets.Beta.equipes[3]];
    const argent1Teams = [pouleBuckets.Gamma.equipes[0], pouleBuckets.Gamma.equipes[1], pouleBuckets.Delta.equipes[0], pouleBuckets.Delta.equipes[1]];
    const argent5Teams = [pouleBuckets.Gamma.equipes[2], pouleBuckets.Gamma.equipes[3], pouleBuckets.Delta.equipes[2], pouleBuckets.Delta.equipes[3]];

    fillPoule('Or1', or1Teams);
    fillPoule('Or5', or5Teams);
    fillPoule('Argent1', argent1Teams);
    fillPoule('Argent5', argent5Teams);

    const poules = Object.values(pouleBuckets);
    if (typeof seeder.setData === 'function') {
      seeder.setData(poules);
    } else {
      // Fallback: manually insert if repository exposes create-like methods later.
      this.logger.warn('InMemoryEquipeRepository not detected; data may not be injected.');
    }

    this.logger.log(`Mock equipes seeded (${MOCK_TEAMS.length} équipes, driver=memory).`);
  }
}
