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
import {
  canonicalizeJ3SeedPair,
  parseJ3ParticipantLabel,
} from '@/domain/match/services/j3-bracket.utils';

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
type J3SquareHint = {
  squareCode: SquareCode;
  stage: 'semi' | 'postSemi';
};

export type FinalSquare = {
  dbCode: 'I' | 'J' | 'K' | 'L';
  label: string;
  placeRange: string;
  semiFinals: FinalSquareMatch[];
  finalMatch: FinalSquareMatch | null;
  thirdPlaceMatch: FinalSquareMatch | null;
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

    const carres = SQUARES.map((square, index) => {
      const classement = allClassements[index];
      const teamNames = (classement?.equipes ?? [])
        .map((team) => team.name)
        .filter((value): value is string => Boolean(value?.trim()));
      const teamNameSet = new Set(teamNames.map((name) => this.norm(name)));
      const directMatches = j3Matches.filter(
        (match) =>
          match.pouleCode === square.dbCode ||
          match.pouleName === square.label ||
          this.isLegacyJ3SquareLabel(match.pouleName, square.dbCode),
      );
      const squareMatches =
        directMatches.length > 0
          ? directMatches
          : this.fallbackSquareMatches(j3Matches, square.dbCode, teamNameSet);

      const semis = squareMatches.slice(0, 2);
      const postSemis = squareMatches.slice(2);
      const [finalSource, thirdSource] = this.pickFinalAndThird(
        semis,
        postSemis,
      );

      return {
        dbCode: square.dbCode,
        label: square.label,
        placeRange: `${square.rangeStart}..${square.rangeEnd}`,
        semiFinals: semis.map((match) => this.toFinalSquareMatch(match)),
        finalMatch: finalSource ? this.toFinalSquareMatch(finalSource) : null,
        thirdPlaceMatch: thirdSource
          ? this.toFinalSquareMatch(thirdSource)
          : null,
        ranking: this.buildRanking(square.rangeStart, classement),
      } satisfies FinalSquare;
    });

    return {
      jour: 'J3',
      carres,
      computedAt: new Date().toISOString(),
    };
  }

  private fallbackSquareMatches(
    allMatches: Match[],
    squareCode: SquareCode,
    teamNameSet: Set<string>,
  ): Match[] {
    const hintedMatches = allMatches.filter(
      (match) => this.resolveJ3SquareHint(match)?.squareCode === squareCode,
    );

    if (hintedMatches.length > 0) {
      return hintedMatches.sort(
        (a, b) =>
          a.date.getTime() - b.date.getTime() ||
          a.id.localeCompare(b.id, 'fr-FR'),
      );
    }

    return allMatches
      .filter(
        (match) =>
          teamNameSet.has(this.norm(match.teamA)) &&
          teamNameSet.has(this.norm(match.teamB)),
      )
      .sort(
        (a, b) =>
          a.date.getTime() - b.date.getTime() ||
          a.id.localeCompare(b.id, 'fr-FR'),
      );
  }

  private isLegacyJ3SquareLabel(
    value: string | null | undefined,
    squareCode: SquareCode,
  ): boolean {
    const normalized = this.norm(value ?? '');
    if (!normalized) return false;

    const legacyLabels: Record<SquareCode, string[]> = {
      I: ['or 1-4', 'or 1', 'carré or a', 'carre or a'],
      J: ['or 5-8', 'or 5', 'carré or b', 'carre or b'],
      K: [
        'argent 9-12',
        'argent 9',
        'argent 1',
        'carré argent c',
        'carre argent c',
      ],
      L: [
        'argent 13-16',
        'argent 13',
        'argent 5',
        'carré argent d',
        'carre argent d',
      ],
    };

    return legacyLabels[squareCode].includes(normalized);
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

  private resolveJ3SquareHint(match: Match): J3SquareHint | null {
    const parsedA = parseJ3ParticipantLabel(match.teamA);
    const parsedB = parseJ3ParticipantLabel(match.teamB);
    if (parsedA?.type === 'phase1' && parsedB?.type === 'phase1') {
      const pair = canonicalizeJ3SeedPair(parsedA.seed, parsedB.seed);
      return pair?.squareCode
        ? { squareCode: pair.squareCode, stage: 'semi' }
        : null;
    }

    const phase2Participants = [parsedA, parsedB].filter(
      (value) => value && value.type !== 'phase1' && value.squareCode,
    );
    if (phase2Participants.length > 0) {
      const squareCode = phase2Participants[0]?.squareCode ?? null;
      if (
        squareCode &&
        phase2Participants.every((value) => value?.squareCode === squareCode)
      ) {
        return { squareCode, stage: 'postSemi' };
      }
    }

    return null;
  }

  private pickFinalAndThird(
    semis: Match[],
    postSemis: Match[],
  ): [Match | null, Match | null] {
    if (postSemis.length === 0) return [null, null];
    if (postSemis.length === 1) return [postSemis[0], null];

    const semiOutcomes = semis
      .map((semi) => this.getWinnerLoserNames(semi))
      .filter(
        (value): value is { winner: string; loser: string } => value !== null,
      );

    if (semiOutcomes.length === 2) {
      const winners = new Set(semiOutcomes.map((x) => this.norm(x.winner)));
      const losers = new Set(semiOutcomes.map((x) => this.norm(x.loser)));
      let finalMatch: Match | null = null;
      let thirdPlaceMatch: Match | null = null;
      for (const match of postSemis) {
        const teams = new Set([this.norm(match.teamA), this.norm(match.teamB)]);
        if (this.sameSet(teams, winners)) {
          finalMatch = match;
          continue;
        }
        if (this.sameSet(teams, losers)) {
          thirdPlaceMatch = match;
        }
      }
      if (finalMatch || thirdPlaceMatch) {
        return [
          finalMatch ?? postSemis[0] ?? null,
          thirdPlaceMatch ??
            postSemis.find((m) => m.id !== (finalMatch?.id ?? '')) ??
            null,
        ];
      }
    }

    return [postSemis[0] ?? null, postSemis[1] ?? null];
  }

  private sameSet(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const item of a) {
      if (!b.has(item)) return false;
    }
    return true;
  }

  private getWinnerLoserNames(
    match: Match,
  ): { winner: string; loser: string } | null {
    if (match.status !== 'finished') return null;
    const scoreA = match.scoreA ?? 0;
    const scoreB = match.scoreB ?? 0;
    if (scoreA === scoreB) {
      return { winner: match.teamA, loser: match.teamB };
    }
    return scoreA > scoreB
      ? { winner: match.teamA, loser: match.teamB }
      : { winner: match.teamB, loser: match.teamA };
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
      .filter((team) => !this.isPendingRankingPlaceholder(team.name))
      .sort((a, b) => a.rang - b.rang)
      .slice(0, 4);
    classementRows.forEach((team, index) => {
      ranking[index].team = this.toTeamRef(team.id, team.name, team.logoUrl);
      ranking[index].placeholder = null;
    });

    return ranking;
  }

  private isPendingRankingPlaceholder(value: string): boolean {
    const normalized = this.norm(value);
    return normalized.startsWith('en attente');
  }
}
