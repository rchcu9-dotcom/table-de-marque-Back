import { Injectable } from '@nestjs/common';
import { Match } from '@/domain/match/entities/match.entity';
import { MatchRepository } from '@/domain/match/repositories/match.repository';
import { PrismaService } from './prisma.service';
import { SURFACE_BY_COMPETITION, JourKey } from './match-enrichment.mapping';
import {
  buildTeamLogoUrl,
  toUiPouleCode,
  pouleDisplayName,
  normalizeKey,
} from './mysql-utils';
import {
  MatchEnrichmentService,
  TaMatchRow,
  TaEquipeRow,
  TaJoueurChallengeRow,
} from './match-enrichment.service';

@Injectable()
export class MySqlMatchRepository implements MatchRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrichment: MatchEnrichmentService,
  ) {}

  create(match: Match): Promise<Match> {
    void match;
    return Promise.reject(new Error('MySQL repository is read-only.'));
  }

  update(match: Match): Promise<Match> {
    void match;
    return Promise.reject(new Error('MySQL repository is read-only.'));
  }

  delete(id: string): Promise<void> {
    void id;
    return Promise.reject(new Error('MySQL repository is read-only.'));
  }

  async findAll(): Promise<Match[]> {
    const [matchRows, equipeRows, joueurRows] = await Promise.all([
      this.prisma.$queryRaw<TaMatchRow[]>`
        SELECT NUM_MATCH, MATCH_CASE, EQUIPE1, EQUIPE2, EQUIPE_ID1, EQUIPE_ID2,
               SCORE1, SCORE2, ECART, ETAT,
               DATE_FORMAT(DATEHEURE, '%Y-%m-%d %H:%i:%s') AS DATEHEURE_SQL,
               SURFACAGE
        FROM TA_MATCHS
        ORDER BY DATEHEURE ASC, NUM_MATCH ASC
      `,
      this.prisma.$queryRaw<TaEquipeRow[]>`
        SELECT e.ID, e.EQUIPE, e.IMAGE,
               DATE_FORMAT(MIN(c.CHALLENGE_SAMEDI), '%Y-%m-%d %H:%i:%s') AS CHALLENGE_SAMEDI_SQL
        FROM ta_equipes e
        LEFT JOIN ta_classement c ON c.EQUIPE_ID = e.ID
        GROUP BY e.ID, e.EQUIPE, e.IMAGE
      `,
      this.prisma.$queryRaw<TaJoueurChallengeRow[]>`
        SELECT ID, EQUIPE_ID, TIME_VITESSE, TIME_SLALOM, TIR1, TIR2, TIR3
        FROM ta_joueurs
      `,
    ]);

    const equipeById = new Map<number, TaEquipeRow>();
    const equipeByName = new Map<string, TaEquipeRow>();
    equipeRows.forEach((row) => {
      equipeById.set(row.ID, row);
      equipeByName.set(normalizeKey(row.EQUIPE), row);
    });

    const filteredMatches = matchRows.filter((row) => row.SURFACAGE === 0);
    const jourByDate = this.enrichment.buildJourMapping(filteredMatches);
    const dayPouleMap = this.enrichment.buildPouleMapByDay(
      filteredMatches,
      jourByDate,
      equipeById,
    );

    const enriched = filteredMatches.map((row) => {
      const matchDate = this.enrichment.toMatchDate(row);
      const jour = jourByDate.get(this.enrichment.toDateKey(matchDate)) ?? null;
      const competitionType =
        row.NUM_MATCH > 100 ? ('3v3' as const) : ('5v5' as const);
      const surface =
        SURFACE_BY_COMPETITION[competitionType] ??
        SURFACE_BY_COMPETITION['5v5'];
      const status =
        competitionType === '3v3'
          ? this.enrichment.mapStatusFromSchedule(matchDate, 30)
          : this.enrichment.mapStatus(row.ETAT);
      const scoreA = status === 'planned' ? null : (row.SCORE1 ?? null);
      const scoreB = status === 'planned' ? null : (row.SCORE2 ?? null);

      let dbLikePouleCode: string | null = null;
      if (competitionType === '5v5' && jour === 'J1') {
        dbLikePouleCode = dayPouleMap.J1.get(row.NUM_MATCH) ?? null;
      } else if (competitionType === '5v5' && jour === 'J2') {
        dbLikePouleCode = dayPouleMap.J2.get(row.NUM_MATCH) ?? null;
      } else if (competitionType === '5v5' && jour === 'J3') {
        dbLikePouleCode = this.enrichment.inferJ3PouleCode(row);
      }

      const pouleCode = toUiPouleCode(dbLikePouleCode);
      const pouleName = pouleDisplayName(pouleCode);
      const phase = this.enrichment.resolvePhase(jour as JourKey | null, pouleCode);

      return new Match(
        String(row.NUM_MATCH),
        matchDate,
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
        row.ECART ?? null,
      );
    });

    const challengeProgressByTeam =
      this.enrichment.buildChallengeProgressByTeam(joueurRows);
    const challengeMatches = this.enrichment.buildChallengeMatches(
      equipeRows,
      challengeProgressByTeam,
    );
    const all = [...enriched, ...challengeMatches];
    return all.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  async findById(id: string): Promise<Match | null> {
    const all = await this.findAll();
    return all.find((m) => m.id === id) ?? null;
  }
}
