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

export type FinalSquare = {
  dbCode: 'E' | 'F' | 'G' | 'H';
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
  dbCode: 'E' | 'F' | 'G' | 'H';
  label: string;
  rangeStart: number;
  rangeEnd: number;
}> = [
  { dbCode: 'E', label: 'Carré Or A', rangeStart: 1, rangeEnd: 4 },
  { dbCode: 'F', label: 'Carré Or B', rangeStart: 5, rangeEnd: 8 },
  { dbCode: 'G', label: 'Carré Argent C', rangeStart: 9, rangeEnd: 12 },
  { dbCode: 'H', label: 'Carré Argent D', rangeStart: 13, rangeEnd: 16 },
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

      const squareMatches = j3Matches.filter((match) => {
        return (
          teamNameSet.has(this.norm(match.teamA)) &&
          teamNameSet.has(this.norm(match.teamB))
        );
      });

      const semis = squareMatches.slice(0, 2);
      const postSemis = squareMatches.slice(2);
      const [finalSource, thirdSource] = this.pickFinalAndThird(
        semis,
        postSemis,
      );

      const semiFinals = semis.map((match) => this.toFinalSquareMatch(match));
      const finalMatch = finalSource
        ? this.toFinalSquareMatch(finalSource)
        : null;
      const thirdPlaceMatch = thirdSource
        ? this.toFinalSquareMatch(thirdSource)
        : null;
      const ranking = this.buildRanking({
        rangeStart: square.rangeStart,
        finalMatch,
        thirdPlaceMatch,
      });

      return {
        dbCode: square.dbCode,
        label: square.label,
        placeRange: `${square.rangeStart}..${square.rangeEnd}`,
        semiFinals,
        finalMatch,
        thirdPlaceMatch,
        ranking,
      } satisfies FinalSquare;
    });

    return {
      jour: 'J3',
      carres,
      computedAt: new Date().toISOString(),
    };
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

  private buildRanking(args: {
    rangeStart: number;
    finalMatch: FinalSquareMatch | null;
    thirdPlaceMatch: FinalSquareMatch | null;
  }): RankingEntry[] {
    const ranking: RankingEntry[] = [1, 2, 3, 4].map((rankInSquare) => ({
      rankInSquare: rankInSquare as 1 | 2 | 3 | 4,
      place: args.rangeStart + rankInSquare - 1,
      team: null,
      placeholder: RANKING_PLACEHOLDER,
    }));

    const finalOutcome = this.getOutcome(args.finalMatch);
    if (finalOutcome) {
      ranking[0].team = finalOutcome.winner;
      ranking[0].placeholder = null;
      ranking[1].team = finalOutcome.loser;
      ranking[1].placeholder = null;
    }

    const thirdOutcome = this.getOutcome(args.thirdPlaceMatch);
    if (thirdOutcome) {
      ranking[2].team = thirdOutcome.winner;
      ranking[2].placeholder = null;
      ranking[3].team = thirdOutcome.loser;
      ranking[3].placeholder = null;
    }

    return ranking;
  }

  private getOutcome(
    match: FinalSquareMatch | null,
  ): { winner: TeamRef; loser: TeamRef } | null {
    if (!match || match.status !== 'finished') return null;
    const scoreA = match.scoreA ?? 0;
    const scoreB = match.scoreB ?? 0;
    if (scoreA === scoreB) {
      return { winner: match.teamA, loser: match.teamB };
    }
    return scoreA > scoreB
      ? { winner: match.teamA, loser: match.teamB }
      : { winner: match.teamB, loser: match.teamA };
  }
}
