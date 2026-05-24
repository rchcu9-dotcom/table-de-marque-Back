import { Inject, Injectable } from '@nestjs/common';
import {
  EQUIPE_REPOSITORY,
  EquipeRepository,
} from '@/domain/equipe/repositories/equipe.repository';
import {
  MATCH_REPOSITORY,
  MatchRepository,
} from '@/domain/match/repositories/match.repository';
import { Match } from '@/domain/match/entities/match.entity';

type TeamRef = {
  id: string;
  name: string;
  logoUrl: string | null;
};

type FinalSquareMatch = {
  id: string;
  date: string;
  status: 'planned' | 'ongoing' | 'finished';
  teamA: TeamRef;
  teamB: TeamRef;
  scoreA: number | null;
  scoreB: number | null;
  winnerTeamId: string | null;
};

type RankingEntry = {
  rankInSquare: 1 | 2 | 3 | 4;
  place: number;
  team: TeamRef | null;
  placeholder: string | null;
};

type SquareCode = 'I' | 'J' | 'K' | 'L';

export type FinalSquare = {
  dbCode: 'I' | 'J' | 'K' | 'L';
  label: string;
  placeRange: string;
  matches: FinalSquareMatch[];
  ranking: RankingEntry[];
};

export type J3FinalSquaresResponse = {
  jour: 'J3';
  carres: FinalSquare[];
  computedAt: string;
};

const RANKING_PLACEHOLDER = 'En attente du résultat';

const SQUARES: Array<{
  dbCode: 'I' | 'J' | 'K' | 'L';
  label: string;
  rangeStart: number;
  rangeEnd: number;
}> = [
  { dbCode: 'I', label: 'Carré Or 1', rangeStart: 1, rangeEnd: 4 },
  { dbCode: 'J', label: 'Carré Or 5', rangeStart: 5, rangeEnd: 8 },
  { dbCode: 'K', label: 'Carré Argent 9', rangeStart: 9, rangeEnd: 12 },
  { dbCode: 'L', label: 'Carré Argent 13', rangeStart: 13, rangeEnd: 16 },
];

@Injectable()
export class GetJ3FinalSquaresUseCase {
  constructor(
    @Inject(EQUIPE_REPOSITORY)
    private readonly equipeRepository: EquipeRepository,
    @Inject(MATCH_REPOSITORY)
    private readonly matchRepository: MatchRepository,
  ) {}

  async execute(): Promise<J3FinalSquaresResponse> {
    const [allMatches, allClassements] = await Promise.all([
      this.matchRepository.findAll(),
      Promise.all(
        SQUARES.map((square) =>
          this.equipeRepository.findClassementByPoule(square.dbCode),
        ),
      ),
    ]);

    const j3Matches = allMatches
      .filter((match) => match.competitionType === '5v5' && match.jour === 'J3')
      .sort(
        (a, b) =>
          a.date.getTime() - b.date.getTime() ||
          a.id.localeCompare(b.id, 'fr-FR'),
      );

    // Build lookup: normalized team name/id → square dbCode (real teams only, no placeholders)
    const teamToSquare = new Map<string, SquareCode>();
    SQUARES.forEach((square, index) => {
      const classement = allClassements[index];
      (classement?.equipes ?? [])
        .filter((team) => !this.isCarreAlias(team.name))
        .forEach((team) => {
          teamToSquare.set(this.norm(team.name), square.dbCode);
          teamToSquare.set(this.norm(team.id), square.dbCode);
        });
    });

    const carres = SQUARES.map((square, index) => {
      const classement = allClassements[index];
      const squareMatches = j3Matches.filter(
        (match) => this.resolveSquare(match, teamToSquare) === square.dbCode,
      );

      return {
        dbCode: square.dbCode,
        label: square.label,
        placeRange: `${square.rangeStart}..${square.rangeEnd}`,
        matches: squareMatches.map((match) => this.toFinalSquareMatch(match)),
        ranking: this.buildRanking(square.rangeStart, classement),
      } satisfies FinalSquare;
    });

    return {
      jour: 'J3',
      carres,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * Resolve which square a J3 match belongs to, in priority order:
   * 1. Real team found in classement → that square
   * 2. Placeholder alias (E1/E2/F1/F2→I, E3/E4/F3/F4→J, G1/G2/H1/H2→K, G3/G4/H3/H4→L)
   * 3. pouleCode from DB as last fallback
   */
  private resolveSquare(
    match: Match,
    teamToSquare: Map<string, SquareCode>,
  ): SquareCode | null {
    const fromA = teamToSquare.get(this.norm(match.teamA));
    if (fromA) return fromA;
    const fromB = teamToSquare.get(this.norm(match.teamB));
    if (fromB) return fromB;

    const fromAlias = this.aliasSquare(match.teamA, match.teamB);
    if (fromAlias) return fromAlias;

    const code = match.pouleCode as SquareCode | null;
    if (code && SQUARES.some((s) => s.dbCode === code)) return code;

    return null;
  }

  /**
   * Extract square code from placeholder team names using group references.
   * E1/E2/F1/F2 → I | E3/E4/F3/F4 → J | G1/G2/H1/H2 → K | G3/G4/H3/H4 → L
   */
  private aliasSquare(teamA: string, teamB: string): SquareCode | null {
    const text = `${teamA} ${teamB}`.toUpperCase();
    const refs = text.match(/[EFGH]\d/g) ?? [];
    for (const ref of refs) {
      const letter = ref[0] as 'E' | 'F' | 'G' | 'H';
      const num = parseInt(ref[1], 10);
      if ((letter === 'E' || letter === 'F') && num <= 2) return 'I';
      if ((letter === 'E' || letter === 'F') && num >= 3) return 'J';
      if ((letter === 'G' || letter === 'H') && num <= 2) return 'K';
      if ((letter === 'G' || letter === 'H') && num >= 3) return 'L';
    }
    return null;
  }

  private isCarreAlias(value: string): boolean {
    const normalized = this.norm(value);
    if (normalized.startsWith('en attente')) return true;
    return /^(vain|perd)\s+cl\d+$/.test(normalized);
  }

  private norm(value: string): string {
    return value.trim().toLowerCase();
  }

  private toTeamRef(
    id: string,
    name: string,
    logoUrl: string | null | undefined,
  ): TeamRef {
    return { id, name, logoUrl: logoUrl ?? null };
  }

  private toSquareStatus(status: Match['status']): FinalSquareMatch['status'] {
    if (status === 'ongoing') return 'ongoing';
    if (status === 'finished') return 'finished';
    return 'planned';
  }

  private toFinalSquareMatch(match: Match): FinalSquareMatch {
    const winnerTeamId = this.resolveWinnerTeamId(match);
    return {
      id: match.id,
      date: match.date.toISOString(),
      status: this.toSquareStatus(match.status),
      teamA: this.toTeamRef(match.teamA, match.teamA, match.teamALogo),
      teamB: this.toTeamRef(match.teamB, match.teamB, match.teamBLogo),
      scoreA: match.scoreA ?? null,
      scoreB: match.scoreB ?? null,
      winnerTeamId,
    };
  }

  private resolveWinnerTeamId(match: Match): string | null {
    if (match.status !== 'finished') {
      return null;
    }
    const scoreA = match.scoreA ?? 0;
    const scoreB = match.scoreB ?? 0;
    if (scoreA === scoreB) {
      // Rule J3 finales: no draw, team A wins when equal.
      return match.teamA;
    }
    return scoreA > scoreB ? match.teamA : match.teamB;
  }

  private buildRanking(
    rangeStart: number,
    classement:
      | {
          equipes: Array<{
            id: string;
            name: string;
            logoUrl?: string | null;
            rang: number;
          }>;
        }
      | null
      | undefined,
  ): RankingEntry[] {
    const ranking: RankingEntry[] = [1, 2, 3, 4].map((rankInSquare) => ({
      rankInSquare: rankInSquare as 1 | 2 | 3 | 4,
      place: rangeStart + rankInSquare - 1,
      team: null,
      placeholder: RANKING_PLACEHOLDER,
    }));

    const classementRows = [...(classement?.equipes ?? [])]
      .filter((team) => !this.isCarreAlias(team.name))
      .sort((a, b) => a.rang - b.rang)
      .slice(0, 4);
    classementRows.forEach((team) => {
      const rankIndex = team.rang - rangeStart;
      if (rankIndex >= 0 && rankIndex < 4) {
        ranking[rankIndex].team = this.toTeamRef(team.id, team.name, team.logoUrl);
        ranking[rankIndex].placeholder = null;
      }
    });

    return ranking;
  }
}
