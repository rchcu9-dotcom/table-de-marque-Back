/* eslint-disable */
﻿import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

import { Match } from '@/domain/match/entities/match.entity';
import {
  MATCH_REPOSITORY,
  MatchRepository,
} from '@/domain/match/repositories/match.repository';
import {
  JOUEUR_REPOSITORY,
  JoueurRepository,
} from '@/domain/joueur/repositories/joueur.repository';
import { Joueur } from '@/domain/joueur/entities/joueur.entity';
import { MOCK_TEAMS } from './mock-teams.data';

type SeedMatchParams = {
  date: string;
  teamA: string;
  teamB: string;
  competitionType: '5v5' | '3v3' | 'challenge';
  surface: 'GG' | 'PG';
  phase: 'brassage' | 'qualification' | 'finales';
  jour: 'J1' | 'J2' | 'J3';
  pouleCode: string;
  pouleName: string;
};

@Injectable()
export class MockScheduleSeeder implements OnModuleInit {
  private readonly logger = new Logger(MockScheduleSeeder.name);

  constructor(
    @Inject(MATCH_REPOSITORY)
    private readonly matchRepo: MatchRepository,
    @Inject(JOUEUR_REPOSITORY)
    private readonly joueurRepo: JoueurRepository,
  ) {}

  async onModuleInit() {
    if ((process.env.USE_MOCK_SCHEDULE ?? '').toLowerCase() !== 'true') {
      return;
    }
    const driver = (process.env.MATCH_REPOSITORY_DRIVER ?? '').toLowerCase();
    if (driver && driver !== 'memory') {
      this.logger.warn(
        'Mock schedule seeding skipped: MATCH_REPOSITORY_DRIVER is not memory.',
      );
      return;
    }

    if (typeof (this.matchRepo as any).clear === 'function')
      (this.matchRepo as any).clear();
    if (typeof (this.joueurRepo as any).clear === 'function')
      (this.joueurRepo as any).clear();

    // Seed joueurs : 15 par équipe (id court)
    const positions: Array<'Att' | 'Def' | 'Gar'> = [
      'Att',
      'Def',
      'Att',
      'Def',
      'Gar',
    ];
    for (const team of MOCK_TEAMS) {
      for (let i = 0; i < 15; i++) {
        const numero = i + 1;
        const poste = positions[i % positions.length];
        const joueur = new Joueur(
          uuid(),
          team.id,
          `${team.id} Joueur ${numero}`,
          numero,
          poste,
        );
        await this.joueurRepo.create(joueur);
      }
    }

    // Helpers
    const slot27 = (startIso: string, idx: number) => {
      const d = new Date(startIso);
      d.setMinutes(d.getMinutes() + 27 * idx);
      return d.toISOString();
    };
    const roundRobin = (
      teams: string[],
      baseDate: string,
      offset: number,
      pouleCode: string,
      pouleName: string,
      phase: SeedMatchParams['phase'],
      jour: SeedMatchParams['jour'],
      competitionType: SeedMatchParams['competitionType'],
      surface: SeedMatchParams['surface'],
    ) => {
      const matches: SeedMatchParams[] = [];
      let idx = offset;
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          matches.push({
            date: slot27(baseDate, idx++),
            teamA: teams[i],
            teamB: teams[j],
            competitionType,
            surface,
            phase,
            jour,
            pouleCode,
            pouleName,
          });
        }
      }
      return matches;
    };

    // Poule J1 : 4 poules A-D
    const poules = {
      A: MOCK_TEAMS.slice(0, 4).map((t) => t.id),
      B: MOCK_TEAMS.slice(4, 8).map((t) => t.id),
      C: MOCK_TEAMS.slice(8, 12).map((t) => t.id),
      D: MOCK_TEAMS.slice(12, 16).map((t) => t.id),
    };

    const seedData: SeedMatchParams[] = [];
    let offset = 0;
    for (const [code, teams] of Object.entries(poules)) {
      seedData.push(
        ...roundRobin(
          teams,
          '2026-05-23T09:00:00Z',
          offset,
          code,
          `Poule ${code}`,
          'brassage',
          'J1',
          '5v5',
          'GG',
        ),
      );
      offset += 6; // 6 matchs par poule
    }

    // Qualification J2
    const alpha = [poules.A[0], poules.A[1], poules.B[0], poules.B[1]];
    const beta = [poules.C[0], poules.C[1], poules.D[0], poules.D[1]];
    const gamma = [poules.A[2], poules.A[3], poules.B[2], poules.B[3]];
    const delta = [poules.C[2], poules.C[3], poules.D[2], poules.D[3]];

    seedData.push(
      ...roundRobin(
        alpha,
        '2026-05-24T09:00:00Z',
        0,
        'Alpha',
        'Tournoi Or - Alpha',
        'qualification',
        'J2',
        '5v5',
        'GG',
      ),
      ...roundRobin(
        beta,
        '2026-05-24T09:00:00Z',
        6,
        'Beta',
        'Tournoi Or - Beta',
        'qualification',
        'J2',
        '5v5',
        'GG',
      ),
      ...roundRobin(
        gamma,
        '2026-05-24T12:00:00Z',
        0,
        'Gamma',
        'Tournoi Argent - Gamma',
        'qualification',
        'J2',
        '5v5',
        'GG',
      ),
      ...roundRobin(
        delta,
        '2026-05-24T12:00:00Z',
        6,
        'Delta',
        'Tournoi Argent - Delta',
        'qualification',
        'J2',
        '5v5',
        'GG',
      ),
    );

    // Finales J3 (4 carrés)
    const buildCarre = (
      teams: string[],
      code: string,
      name: string,
      startIso: string,
    ) => {
      const slots = (i: number) => slot27(startIso, i);
      return [
        {
          date: slots(0),
          teamA: teams[0],
          teamB: teams[3],
          competitionType: '5v5',
          surface: 'GG',
          phase: 'finales',
          jour: 'J3',
          pouleCode: code,
          pouleName: name,
        },
        {
          date: slots(1),
          teamA: teams[1],
          teamB: teams[2],
          competitionType: '5v5',
          surface: 'GG',
          phase: 'finales',
          jour: 'J3',
          pouleCode: code,
          pouleName: name,
        },
        {
          date: slots(2),
          teamA: teams[0],
          teamB: teams[1],
          competitionType: '5v5',
          surface: 'GG',
          phase: 'finales',
          jour: 'J3',
          pouleCode: code,
          pouleName: name,
        },
        {
          date: slots(3),
          teamA: teams[2],
          teamB: teams[3],
          competitionType: '5v5',
          surface: 'GG',
          phase: 'finales',
          jour: 'J3',
          pouleCode: code,
          pouleName: name,
        },
      ] as SeedMatchParams[];
    };

    seedData.push(
      ...buildCarre(alpha, 'Or1', 'Carre Or 1', '2026-05-25T08:00:00Z'),
      ...buildCarre(beta, 'Or5', 'Carre Or 5', '2026-05-25T10:00:00Z'),
      ...buildCarre(gamma, 'Argent1', 'Carre Argent 1', '2026-05-25T12:00:00Z'),
      ...buildCarre(delta, 'Argent5', 'Carre Argent 5', '2026-05-25T14:00:00Z'),
    );

    // Tournoi 3v3 (PG) J2 : 2 matchs par équipe (16 matchs)
    const teams3v3 = MOCK_TEAMS.map((t) => t.id);
    const round1: SeedMatchParams[] = [];
    const round2: SeedMatchParams[] = [];
    for (let i = 0; i < teams3v3.length; i += 2) {
      round1.push({
        date: slot27('2026-05-24T11:00:00Z', i / 2),
        teamA: teams3v3[i],
        teamB: teams3v3[i + 1],
        competitionType: '3v3',
        surface: 'PG',
        phase: 'qualification',
        jour: 'J2',
        pouleCode: '3v3-R1',
        pouleName: '3v3 Round 1',
      });
    }
    const rotated = teams3v3.slice(1).concat(teams3v3[0]);
    for (let i = 0; i < teams3v3.length; i += 2) {
      round2.push({
        date: slot27('2026-05-24T13:00:00Z', i / 2),
        teamA: teams3v3[i],
        teamB: rotated[i],
        competitionType: '3v3',
        surface: 'PG',
        phase: 'qualification',
        jour: 'J2',
        pouleCode: '3v3-R2',
        pouleName: '3v3 Round 2',
      });
    }
    seedData.push(...round1, ...round2);

    const logoMap = new Map(MOCK_TEAMS.map((t) => [t.id, t.logo]));

    // Sépare les compétitions pour appliquer les statuts indépendamment
    const matches5v5 = seedData
      .filter((s) => s.competitionType === '5v5')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const matches3v3 = seedData
      .filter((s) => s.competitionType === '3v3')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    // Challenge individuel (PG) J1 : un crneau de 40 min par quipe
    const challengeSlots: SeedMatchParams[] = MOCK_TEAMS.map((t, idx) => {
      const start = new Date('2026-05-23T09:00:00Z');
      start.setMinutes(start.getMinutes() + 40 * idx);
      return {
        date: start.toISOString(),
        teamA: t.id,
        teamB: 'Challenge',
        competitionType: 'challenge',
        surface: 'PG',
        phase: 'qualification',
        jour: 'J1',
        pouleCode: 'CHALL',
        pouleName: 'Challenge individuel',
      };
    });
    const matchesChallenge = challengeSlots.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    const withStatus = [
      ...matches5v5.map((s, idx) => ({
        seed: s,
        status: idx < 28 ? 'finished' : idx === 28 ? 'ongoing' : 'planned',
      })),
      ...matches3v3.map((s, idx) => ({
        seed: s,
        status: idx < 5 ? 'finished' : idx === 5 ? 'ongoing' : 'planned',
      })),
      ...matchesChallenge.map((s, idx) => ({
        seed: s,
        status: idx === 0 ? 'finished' : idx === 1 ? 'ongoing' : 'planned',
      })),
    ].sort(
      (a, b) =>
        new Date(a.seed.date).getTime() - new Date(b.seed.date).getTime(),
    );

    for (const entry of withStatus) {
      const s = entry.seed;
      const status = entry.status as 'finished' | 'ongoing' | 'planned';
      // Génération de scores simples pour les matchs non "planned"
      const scoreA =
        status === 'planned' ? null : Math.floor(Math.random() * 6) + 1;
      const scoreB =
        status === 'planned'
          ? null
          : Math.max(0, (scoreA ?? 0) - (Math.random() < 0.4 ? 0 : 1)) +
            Math.floor(Math.random() * 3);

      const match = new Match(
        uuid(),
        new Date(s.date),
        s.teamA,
        s.teamB,
        status as any,
        scoreA,
        scoreB,
        logoMap.get(s.teamA) ?? null,
        logoMap.get(s.teamB) ?? null,
        s.pouleCode,
        s.pouleName,
        s.competitionType,
        s.surface,
        s.phase,
        s.jour,
      );
      await this.matchRepo.create(match);
    }

    this.logger.log(
      `Mock schedule seeded (${seedData.length} matches, ${MOCK_TEAMS.length * 15} joueurs)`,
    );
  }
}
