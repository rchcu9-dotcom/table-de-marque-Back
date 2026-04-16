import { Injectable } from '@nestjs/common';
import { Match } from '@/domain/match/entities/match.entity';
import {
  PHASE_BY_JOUR_POULE,
  SURFACE_BY_COMPETITION,
  JourKey,
} from './match-enrichment.mapping';
import {
  buildTeamLogoUrl,
  normalizeKey,
} from './mysql-utils';
import {
  parisDateKey,
  parseParisSqlDateTime,
  parseRequiredParisSqlDateTime,
} from './date-paris.utils';

export type TaMatchRow = {
  NUM_MATCH: number;
  MATCH_CASE: number;
  EQUIPE1: string;
  EQUIPE2: string;
  EQUIPE_ID1: number | null;
  EQUIPE_ID2: number | null;
  SCORE1: number | null;
  SCORE2: number | null;
  ETAT: string;
  DATEHEURE_SQL: string;
  SURFACAGE: number;
};

export type TaEquipeRow = {
  ID: number;
  EQUIPE: string;
  IMAGE: string | null;
  CHALLENGE_SAMEDI_SQL: string | null;
};

export type TaJoueurChallengeRow = {
  ID: number;
  EQUIPE_ID: number;
  TIME_VITESSE: number | null;
  TIME_SLALOM: number | null;
  TIR1: number | null;
  TIR2: number | null;
  TIR3: number | null;
};

export type DayPouleMap = {
  J1: Map<number, string>;
  J2: Map<number, string>;
};

export type ChallengeTeamProgress = {
  hasAnyAttempt: boolean;
  playersCount: number;
  completedCount: number;
};

@Injectable()
export class MatchEnrichmentService {
  toDateKey(date: Date): string {
    return parisDateKey(date);
  }

  toMatchDate(row: TaMatchRow): Date {
    return parseRequiredParisSqlDateTime(
      row.DATEHEURE_SQL,
      'TA_MATCHS.DATEHEURE',
    );
  }

  toChallengeDate(row: TaEquipeRow): Date | null {
    return parseParisSqlDateTime(row.CHALLENGE_SAMEDI_SQL);
  }

  teamKey(rowTeamId: number | null, rowTeamName: string): string {
    if (rowTeamId != null) return `id:${rowTeamId}`;
    return `name:${normalizeKey(rowTeamName)}`;
  }

  mapStatus(value: string): Match['status'] {
    const normalized = (value ?? '').trim().toLowerCase();
    if (normalized === 'c') return 'ongoing';
    if (normalized === 'x') return 'finished';
    return 'planned';
  }

  mapStatusFromSchedule(date: Date, durationMinutes: number): Match['status'] {
    const nowMs = Date.now();
    const startMs = date.getTime();
    const endMs = startMs + durationMinutes * 60 * 1000;
    if (nowMs < startMs) return 'planned';
    if (nowMs < endMs) return 'ongoing';
    return 'finished';
  }

  buildJourMapping(rows: TaMatchRow[]): Map<string, JourKey> {
    const uniqueDates = Array.from(
      new Set(rows.map((row) => this.toDateKey(this.toMatchDate(row)))),
    ).sort();
    const mapping = new Map<string, JourKey>();
    uniqueDates.slice(0, 3).forEach((dateKey, index) => {
      const jour = `J${index + 1}` as JourKey;
      mapping.set(dateKey, jour);
    });
    return mapping;
  }

  buildPouleMapByDay(
    rows: TaMatchRow[],
    jourByDate: Map<string, JourKey>,
    equipeById: Map<number, TaEquipeRow>,
  ): DayPouleMap {
    const byDay = {
      J1: rows.filter(
        (row) =>
          row.NUM_MATCH <= 100 &&
          jourByDate.get(this.toDateKey(this.toMatchDate(row))) === 'J1',
      ),
      J2: rows.filter(
        (row) =>
          row.NUM_MATCH <= 100 &&
          jourByDate.get(this.toDateKey(this.toMatchDate(row))) === 'J2',
      ),
    };

    return {
      J1: this.computeDayPouleMap(byDay.J1, ['A', 'B', 'C', 'D'], equipeById),
      J2: this.computeDayPouleMap(byDay.J2, ['1', '2', '3', '4'], equipeById),
    };
  }

  computeDayPouleMap(
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
        (row.EQUIPE_ID1 != null
          ? equipeById.get(row.EQUIPE_ID1)?.EQUIPE
          : null) ?? row.EQUIPE1;
      const nameB =
        (row.EQUIPE_ID2 != null
          ? equipeById.get(row.EQUIPE_ID2)?.EQUIPE
          : null) ?? row.EQUIPE2;
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

    const components = Array.from(membersByRoot.entries()).map(
      ([root, members]) => {
        const memberSet = new Set(members);
        const firstMatchMs = Math.min(
          ...rows
            .filter((row) => {
              const keyA = this.teamKey(row.EQUIPE_ID1, row.EQUIPE1);
              const keyB = this.teamKey(row.EQUIPE_ID2, row.EQUIPE2);
              return memberSet.has(keyA) && memberSet.has(keyB);
            })
            .map((row) => this.toMatchDate(row).getTime()),
        );
        const minTeamName = Array.from(memberSet)
          .map((key) => keyToDisplayName.get(key) ?? key)
          .sort((a, b) => a.localeCompare(b, 'fr-FR'))[0];
        return { root, members: memberSet, firstMatchMs, minTeamName };
      },
    );

    components.sort((a, b) => {
      if (a.firstMatchMs !== b.firstMatchMs)
        return a.firstMatchMs - b.firstMatchMs;
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

  inferJ3PouleCode(row: TaMatchRow): string | null {
    // Legacy naming: "Or 1", "Or 5", "Argent 1", "Argent 5" in team name text
    const text = `${row.EQUIPE1} ${row.EQUIPE2}`.toLowerCase();
    if (/\bor\s*1\b/.test(text)) return 'Or 1';
    if (/\bor\s*5\b/.test(text)) return 'Or 5';
    if (/\bargent\s*1\b/.test(text)) return 'Argent 1';
    if (/\bargent\s*5\b/.test(text)) return 'Argent 5';

    // New bracket naming — Phase 2: vA1B2 / pC3D4 (winner/loser of Phase 1 match XnYm)
    const bracketRe = /^[vp]([A-D])[1-4][A-D][1-4]$/;
    const bm1 = row.EQUIPE1.match(bracketRe);
    const bm2 = row.EQUIPE2.match(bracketRe);
    if (bm1 && bm2) {
      const pool = bm1[1];
      return pool === 'A' || pool === 'B' ? 'Or 1' : 'Argent 1';
    }

    // New bracket naming — Phase 1: A1, B2, C3, D4 (J2 team slot labels)
    const phase1Re = /^([A-D])[1-4]$/;
    const pm1 = row.EQUIPE1.match(phase1Re);
    const pm2 = row.EQUIPE2.match(phase1Re);
    if (pm1 && pm2) {
      const pool = pm1[1];
      return pool === 'A' || pool === 'B' ? 'Or 1' : 'Argent 1';
    }

    const squareCode = this.inferJ3SquareCode(row);
    if (squareCode) return squareCode;

    return null;
  }

  inferJ3SquareCode(row: TaMatchRow): 'E' | 'F' | 'G' | 'H' | null {
    const matchNum = row.NUM_MATCH;
    if (matchNum >= 49 && matchNum <= 56) {
      const bySemiPair: Array<'G' | 'H' | 'E' | 'F'> = ['G', 'H', 'E', 'F'];
      return bySemiPair[Math.floor((matchNum - 49) / 2)] ?? null;
    }
    if (matchNum >= 57 && matchNum <= 64) {
      const byPhase2Slot: Array<'G' | 'H' | 'E' | 'F'> = ['G', 'H', 'E', 'F'];
      return byPhase2Slot[(matchNum - 57) % 4] ?? null;
    }
    return null;
  }

  resolvePhase(
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

  buildChallengeMatches(
    equipes: TaEquipeRow[],
    progressByTeam: Map<number, ChallengeTeamProgress>,
  ): Match[] {
    const nowMs = Date.now();
    const challengeDurationMs = 40 * 60 * 1000;
    return equipes
      .map((row) => ({ row, challengeDate: this.toChallengeDate(row) }))
      .filter(({ challengeDate }) => challengeDate)
      .map((row) => {
        const date = row.challengeDate ?? new Date();
        const progress = progressByTeam.get(row.row.ID);
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
          `challenge-${row.row.ID}`,
          date,
          row.row.EQUIPE,
          'Challenge',
          status,
          null,
          null,
          buildTeamLogoUrl(row.row.EQUIPE),
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

  buildChallengeProgressByTeam(
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
