import { Injectable } from '@nestjs/common';
import { Match } from '@/domain/match/entities/match.entity';
import { MatchRepository } from '@/domain/match/repositories/match.repository';
import { PrismaService } from './prisma.service';
import {
  PHASE_BY_JOUR_POULE,
  SURFACE_BY_COMPETITION,
  JourKey,
} from './match-enrichment.mapping';
import {
  buildTeamLogoUrl,
  normalizeKey,
  pouleDisplayName,
  toUiPouleCode,
} from './mysql-utils';
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

type TaJoueurChallengeRow = {
  ID: number;
  EQUIPE_ID: number;
  TIME_VITESSE: number | null;
  TIME_SLALOM: number | null;
  TIR1: number | null;
  TIR2: number | null;
  TIR3: number | null;
};

type DayPouleMap = {
  J1: Map<number, string>;
  J2: Map<number, string>;
};

type ChallengeTeamProgress = {
  hasAnyAttempt: boolean;
  playersCount: number;
  completedCount: number;
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
    const [matchRows, equipeRows, joueurRows] = await Promise.all([
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
    const jourByDate = this.buildJourMapping(filteredMatches);
    const dayPouleMap = this.buildPouleMapByDay(filteredMatches, jourByDate, equipeById);

    const enriched = filteredMatches.map((row) => {
      const jour = jourByDate.get(this.toDateKey(row.DATEHEURE)) ?? null;
      const competitionType =
        row.NUM_MATCH > 100 ? ('3v3' as const) : ('5v5' as const);
      const surface =
        SURFACE_BY_COMPETITION[competitionType] ?? SURFACE_BY_COMPETITION['5v5'];
      const status = this.mapStatus(row.ETAT);
      const scoreA = status === 'planned' ? null : row.SCORE1 ?? null;
      const scoreB = status === 'planned' ? null : row.SCORE2 ?? null;

      let dbLikePouleCode: string | null = null;
      if (competitionType === '5v5' && jour === 'J1') {
        dbLikePouleCode = dayPouleMap.J1.get(row.NUM_MATCH) ?? null;
      } else if (competitionType === '5v5' && jour === 'J2') {
        dbLikePouleCode = dayPouleMap.J2.get(row.NUM_MATCH) ?? null;
      } else if (competitionType === '5v5' && jour === 'J3') {
        dbLikePouleCode = this.inferJ3PouleCode(row);
      }

      const pouleCode = toUiPouleCode(dbLikePouleCode);
      const pouleName = pouleDisplayName(pouleCode);
      const phase = this.resolvePhase(jour, pouleCode);

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

    const challengeProgressByTeam = this.buildChallengeProgressByTeam(joueurRows);
    const challengeMatches = this.buildChallengeMatches(
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

  private teamKey(rowTeamId: number | null, rowTeamName: string): string {
    if (rowTeamId != null) return `id:${rowTeamId}`;
    return `name:${normalizeKey(rowTeamName)}`;
  }

  private buildPouleMapByDay(
    rows: TaMatchRow[],
    jourByDate: Map<string, JourKey>,
    equipeById: Map<number, TaEquipeRow>,
  ): DayPouleMap {
    const byDay = {
      J1: rows.filter(
        (row) =>
          row.NUM_MATCH <= 100 &&
          jourByDate.get(this.toDateKey(row.DATEHEURE)) === 'J1',
      ),
      J2: rows.filter(
        (row) =>
          row.NUM_MATCH <= 100 &&
          jourByDate.get(this.toDateKey(row.DATEHEURE)) === 'J2',
      ),
    };

    return {
      J1: this.computeDayPouleMap(byDay.J1, ['A', 'B', 'C', 'D'], equipeById),
      J2: this.computeDayPouleMap(byDay.J2, ['1', '2', '3', '4'], equipeById),
    };
  }

  private computeDayPouleMap(
    rows: TaMatchRow[],
    dayCodes: string[],
    equipeById: Map<number, TaEquipeRow>,
  ): Map<number, string> {
    const parent = new Map<string, string>();
    const rank = new Map<string, number>();
    const keyToDisplayName = new Map<string, string>();

    const ensureNode = (key: string, display: string) => {
      if (!parent.has(key)) {
        parent.set(key, key);
        rank.set(key, 0);
      }
      if (!keyToDisplayName.has(key) && display.trim().length > 0) {
        keyToDisplayName.set(key, display.trim());
      }
    };

    const find = (key: string): string => {
      const p = parent.get(key);
      if (!p) {
        parent.set(key, key);
        rank.set(key, 0);
        return key;
      }
      if (p === key) return key;
      const root = find(p);
      parent.set(key, root);
      return root;
    };

    const union = (a: string, b: string) => {
      const ra = find(a);
      const rb = find(b);
      if (ra === rb) return;
      const rka = rank.get(ra) ?? 0;
      const rkb = rank.get(rb) ?? 0;
      if (rka < rkb) {
        parent.set(ra, rb);
        return;
      }
      if (rkb < rka) {
        parent.set(rb, ra);
        return;
      }
      parent.set(rb, ra);
      rank.set(ra, rka + 1);
    };

    for (const row of rows) {
      const nameA =
        (row.EQUIPE_ID1 != null ? equipeById.get(row.EQUIPE_ID1)?.EQUIPE : null) ??
        row.EQUIPE1;
      const nameB =
        (row.EQUIPE_ID2 != null ? equipeById.get(row.EQUIPE_ID2)?.EQUIPE : null) ??
        row.EQUIPE2;
      const teamAKey = this.teamKey(row.EQUIPE_ID1, row.EQUIPE1);
      const teamBKey = this.teamKey(row.EQUIPE_ID2, row.EQUIPE2);
      ensureNode(teamAKey, nameA);
      ensureNode(teamBKey, nameB);
      union(teamAKey, teamBKey);
    }

    const membersByRoot = new Map<string, Set<string>>();
    for (const key of parent.keys()) {
      const root = find(key);
      if (!membersByRoot.has(root)) membersByRoot.set(root, new Set<string>());
      membersByRoot.get(root)!.add(key);
    }

    const components = Array.from(membersByRoot.entries()).map(([root, members]) => {
      const memberSet = new Set(members);
      const firstMatchMs = Math.min(
        ...rows
          .filter((row) => {
            const keyA = this.teamKey(row.EQUIPE_ID1, row.EQUIPE1);
            const keyB = this.teamKey(row.EQUIPE_ID2, row.EQUIPE2);
            return memberSet.has(keyA) && memberSet.has(keyB);
          })
          .map((row) => new Date(row.DATEHEURE).getTime()),
      );
      const minTeamName = Array.from(memberSet)
        .map((key) => keyToDisplayName.get(key) ?? key)
        .sort((a, b) => a.localeCompare(b, 'fr-FR'))[0];
      return { root, members: memberSet, firstMatchMs, minTeamName };
    });

    components.sort((a, b) => {
      if (a.firstMatchMs !== b.firstMatchMs) return a.firstMatchMs - b.firstMatchMs;
      return a.minTeamName.localeCompare(b.minTeamName, 'fr-FR');
    });

    const codeByRoot = new Map<string, string>();
    components.forEach((component, index) => {
      if (index < dayCodes.length) {
        codeByRoot.set(component.root, dayCodes[index]);
      }
    });

    const pouleByMatchNum = new Map<number, string>();
    for (const row of rows) {
      const keyA = this.teamKey(row.EQUIPE_ID1, row.EQUIPE1);
      const keyB = this.teamKey(row.EQUIPE_ID2, row.EQUIPE2);
      const codeA = codeByRoot.get(find(keyA));
      const codeB = codeByRoot.get(find(keyB));
      const code = codeA ?? codeB;
      if (code && codeA === codeB) {
        pouleByMatchNum.set(row.NUM_MATCH, code);
      }
    }

    return pouleByMatchNum;
  }

  private inferJ3PouleCode(row: TaMatchRow): string | null {
    const text = `${row.EQUIPE1} ${row.EQUIPE2}`.toLowerCase();
    if (/\bor\s*1\b/.test(text)) return 'Or 1';
    if (/\bor\s*5\b/.test(text)) return 'Or 5';
    if (/\bargent\s*1\b/.test(text)) return 'Argent 1';
    if (/\bargent\s*5\b/.test(text)) return 'Argent 5';
    return null;
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
    if (
      phase === 'brassage' ||
      phase === 'qualification' ||
      phase === 'finales'
    ) {
      return phase;
    }
    return null;
  }

  private buildChallengeMatches(
    equipes: TaEquipeRow[],
    progressByTeam: Map<number, ChallengeTeamProgress>,
  ): Match[] {
    const nowMs = Date.now();
    const challengeDurationMs = 45 * 60 * 1000;
    return equipes
      .filter((row) => row.CHALLENGE_SAMEDI)
      .map((row) => {
        const date = row.CHALLENGE_SAMEDI
          ? new Date(row.CHALLENGE_SAMEDI)
          : new Date();
        const progress = progressByTeam.get(row.ID);
        const hasStarted = progress?.hasAnyAttempt ?? false;
        const playersCount = progress?.playersCount ?? 0;
        const completedCount = progress?.completedCount ?? 0;
        const allPlayersCompleted =
          playersCount > 0 && completedCount >= playersCount;
        const elapsed = nowMs - date.getTime();

        let status: Match['status'] = 'planned';
        if (date.getTime() > nowMs) {
          status = 'planned';
        } else if (!hasStarted) {
          status = 'planned';
        } else if (allPlayersCompleted || elapsed >= challengeDurationMs) {
          status = 'finished';
        } else {
          status = 'ongoing';
        }
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

  private buildChallengeProgressByTeam(
    rows: TaJoueurChallengeRow[],
  ): Map<number, ChallengeTeamProgress> {
    const progressByTeam = new Map<number, ChallengeTeamProgress>();
    rows.forEach((row) => {
      const current = progressByTeam.get(row.EQUIPE_ID) ?? {
        hasAnyAttempt: false,
        playersCount: 0,
        completedCount: 0,
      };
      current.playersCount += 1;
      const hasAnyAttempt =
        (row.TIME_VITESSE ?? 0) > 0 ||
        (row.TIME_SLALOM ?? 0) > 0 ||
        row.TIR1 !== null ||
        row.TIR2 !== null ||
        row.TIR3 !== null;
      if (hasAnyAttempt) current.hasAnyAttempt = true;
      const hasCompletedAttempt =
        (row.TIME_VITESSE ?? 0) > 0 &&
        (row.TIME_SLALOM ?? 0) > 0 &&
        row.TIR1 !== null &&
        row.TIR2 !== null &&
        row.TIR3 !== null;
      if (hasCompletedAttempt) current.completedCount += 1;
      progressByTeam.set(row.EQUIPE_ID, current);
    });
    return progressByTeam;
  }
}
