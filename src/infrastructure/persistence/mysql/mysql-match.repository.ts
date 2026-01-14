import { Injectable } from '@nestjs/common';
import { Match } from '@/domain/match/entities/match.entity';
import { MatchRepository } from '@/domain/match/repositories/match.repository';
import { PrismaService } from './prisma.service';
import {
  PHASE_BY_JOUR_POULE,
  SURFACE_BY_COMPETITION,
  JourKey,
} from './match-enrichment.mapping';
import { buildTeamLogoUrl, normalizeKey, pouleDisplayName } from './mysql-utils';
import { parisDateKey } from './date-paris.utils';

type TaMatchRow = {
  NUM_MATCH: number;
  MATCH_CASE: number;
  EQUIPE1: string;
  EQUIPE2: string;
  EQUIPE_ID1: number | null;
  EQUIPE_ID2: number | null;
  SCORE1: number | null;
  SCORE2: number | null;
  ETAT: string;
  DATEHEURE: Date;
  SURFACAGE: number;
};

type TaEquipeRow = {
  ID: number;
  EQUIPE: string;
  IMAGE: string | null;
  CHALLENGE_SAMEDI: Date | null;
};

type TaClassementRow = {
  GROUPE_NOM: string;
  EQUIPE_ID: number;
};

@Injectable()
export class MySqlMatchRepository implements MatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(_match: Match): Promise<Match> {
    throw new Error('MySQL repository is read-only.');
  }

  async update(_match: Match): Promise<Match> {
    throw new Error('MySQL repository is read-only.');
  }

  async delete(_id: string): Promise<void> {
    throw new Error('MySQL repository is read-only.');
  }

  async findAll(): Promise<Match[]> {
    const [matchRows, equipeRows, classementRows] = await Promise.all([
      this.prisma.$queryRaw<TaMatchRow[]>`
        SELECT NUM_MATCH, MATCH_CASE, EQUIPE1, EQUIPE2, EQUIPE_ID1, EQUIPE_ID2,
               SCORE1, SCORE2, ETAT, DATEHEURE, SURFACAGE
        FROM TA_MATCHS
        ORDER BY DATEHEURE ASC, NUM_MATCH ASC
      `,
      this.prisma.$queryRaw<TaEquipeRow[]>`
        SELECT ID, EQUIPE, IMAGE, CHALLENGE_SAMEDI
        FROM ta_equipes
      `,
      this.prisma.$queryRaw<TaClassementRow[]>`
        SELECT GROUPE_NOM, EQUIPE_ID
        FROM ta_classement
      `,
    ]);

    const equipeById = new Map<number, TaEquipeRow>();
    const equipeByName = new Map<string, TaEquipeRow>();
    equipeRows.forEach((row) => {
      equipeById.set(row.ID, row);
      equipeByName.set(normalizeKey(row.EQUIPE), row);
    });

    const pouleByEquipeId = new Map<number, string>();
    classementRows.forEach((row) => {
      if (!pouleByEquipeId.has(row.EQUIPE_ID)) {
        pouleByEquipeId.set(row.EQUIPE_ID, row.GROUPE_NOM);
      }
    });

    const filteredMatches = matchRows.filter((row) => row.SURFACAGE === 0);
    const jourByDate = this.buildJourMapping(filteredMatches);

    const enriched = filteredMatches.map((row) => {
      const jour = jourByDate.get(this.toDateKey(row.DATEHEURE)) ?? null;
      const competitionType =
        row.NUM_MATCH > 100 ? ('3v3' as const) : ('5v5' as const);
      const surface =
        SURFACE_BY_COMPETITION[competitionType] ?? SURFACE_BY_COMPETITION['5v5'];
      const status = this.mapStatus(row.ETAT);
      const scoreA = status === 'planned' ? null : row.SCORE1 ?? null;
      const scoreB = status === 'planned' ? null : row.SCORE2 ?? null;

      const pouleCode =
        (row.EQUIPE_ID1
          ? pouleByEquipeId.get(row.EQUIPE_ID1)
          : undefined) ??
        (row.EQUIPE_ID2 ? pouleByEquipeId.get(row.EQUIPE_ID2) : undefined) ??
        null;
      const pouleName = pouleDisplayName(pouleCode);
      const phase = this.resolvePhase(jour, pouleCode);

      const equipeA =
        (row.EQUIPE_ID1 ? equipeById.get(row.EQUIPE_ID1) : undefined) ??
        equipeByName.get(normalizeKey(row.EQUIPE1));
      const equipeB =
        (row.EQUIPE_ID2 ? equipeById.get(row.EQUIPE_ID2) : undefined) ??
        equipeByName.get(normalizeKey(row.EQUIPE2));

      return new Match(
        String(row.NUM_MATCH),
        new Date(row.DATEHEURE),
        row.EQUIPE1,
        row.EQUIPE2,
        status,
        scoreA,
        scoreB,
        buildTeamLogoUrl(row.EQUIPE1),
        buildTeamLogoUrl(row.EQUIPE2),
        pouleCode,
        pouleName,
        competitionType,
        surface,
        phase,
        jour,
      );
    });

    const challengeMatches = this.buildChallengeMatches(equipeRows);
    const all = [...enriched, ...challengeMatches];
    return all.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  async findById(id: string): Promise<Match | null> {
    const all = await this.findAll();
    return all.find((m) => m.id === id) ?? null;
  }

  private mapStatus(value: string): Match['status'] {
    const normalized = (value ?? '').trim().toLowerCase();
    if (normalized === 'c') return 'ongoing';
    if (normalized === 'x') return 'finished';
    return 'planned';
  }

  private toDateKey(date: Date): string {
    return parisDateKey(date);
  }

  private buildJourMapping(rows: TaMatchRow[]): Map<string, JourKey> {
    const uniqueDates = Array.from(
      new Set(rows.map((row) => this.toDateKey(row.DATEHEURE))),
    ).sort();
    const mapping = new Map<string, JourKey>();
    uniqueDates.slice(0, 3).forEach((dateKey, index) => {
      const jour = `J${index + 1}` as JourKey;
      mapping.set(dateKey, jour);
    });
    return mapping;
  }

  private resolvePhase(
    jour: JourKey | null,
    poule: string | null,
  ): Match['phase'] {
    if (!jour || !poule) return null;
    const mapping = PHASE_BY_JOUR_POULE[jour] ?? {};
    const normalized = normalizeKey(poule).replace(/\s+/g, '');
    const entry = Object.entries(mapping).find(
      ([key]) => normalizeKey(key).replace(/\s+/g, '') === normalized,
    );
    if (!entry) return null;
    const phase = entry[1].toLowerCase() as Match['phase'];
    if (phase === 'brassage' || phase === 'qualification' || phase === 'finales') {
      return phase;
    }
    return null;
  }

  private buildChallengeMatches(equipes: TaEquipeRow[]): Match[] {
    const nowMs = Date.now();
    return equipes
      .filter((row) => row.CHALLENGE_SAMEDI)
      .map((row) => {
        const date = row.CHALLENGE_SAMEDI
          ? new Date(row.CHALLENGE_SAMEDI)
          : new Date();
        const status: Match['status'] =
          date.getTime() <= nowMs ? 'finished' : 'planned';
      return new Match(
        `challenge-${row.ID}`,
        date,
        row.EQUIPE,
        'Challenge',
        status,
        null,
        null,
        buildTeamLogoUrl(row.EQUIPE),
        null,
          'CHALL',
          'Challenge individuel',
          'challenge',
          SURFACE_BY_COMPETITION.challenge,
          'qualification',
          'J1',
        );
      });
  }
}
