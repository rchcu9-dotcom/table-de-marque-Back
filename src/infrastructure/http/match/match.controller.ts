import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
} from '@nestjs/common';

import { CreateMatchDto } from '@/application/match/dto/create-match.dto';
import { CreateMatchUseCase } from '@/application/match/use-cases/create-match.usecase';
import { GetAllMatchesUseCase } from '@/application/match/use-cases/get-all-matches.usecase';
import { GetMatchByIdUseCase } from '@/application/match/use-cases/get-match-by-id.usecase';
import { UpdateMatchUseCase } from '@/application/match/use-cases/update-match.usecase';
import { DeleteMatchUseCase } from '@/application/match/use-cases/delete-match.usecase';
import { DeleteMatchDto } from '@/application/match/dto/delete-match.dto';
import { UpdateMatchDto } from '@/application/match/dto/update-match.dto';

import { GetMomentumMatchesUseCase } from '@/application/match/use-cases/get-momentum-matches.usecase';
import { CacheSnapshotService } from '@/infrastructure/cache/cache.snapshot.service';
import { formatParisIso } from '@/infrastructure/persistence/mysql/date-paris.utils';
import type { Match } from '@/domain/match/entities/match.entity';

type MatchResponse = Omit<Match, 'date'> & { date: string };

function toMatchResponse(match: Match): MatchResponse {
  return {
    id: match.id,
    date: formatParisIso(new Date(match.date)),
    teamA: match.teamA,
    teamB: match.teamB,
    status: match.status,
    scoreA: match.scoreA ?? null,
    scoreB: match.scoreB ?? null,
    teamALogo: match.teamALogo ?? null,
    teamBLogo: match.teamBLogo ?? null,
    pouleCode: match.pouleCode ?? null,
    pouleName: match.pouleName ?? null,
    competitionType: match.competitionType ?? '5v5',
    surface: match.surface ?? 'GG',
    phase: match.phase ?? null,
    jour: match.jour ?? null,
  };
}

function mapMatches(matches: Match[]) {
  return matches.map((match) => toMatchResponse(match));
}

@Controller('matches')
export class MatchController {
  constructor(
    private readonly createMatchUseCase: CreateMatchUseCase,
    private readonly getAllMatchesUseCase: GetAllMatchesUseCase,
    private readonly getMatchByIdUseCase: GetMatchByIdUseCase,
    private readonly updateMatchUseCase: UpdateMatchUseCase,
    private readonly deleteMatchUseCase: DeleteMatchUseCase,
    private readonly getMomentumMatchesUseCase: GetMomentumMatchesUseCase,
    private readonly cache: CacheSnapshotService,
  ) {}

  // CREATE
  @Post()
  async create(@Body() dto: CreateMatchDto) {
    const match = await this.createMatchUseCase.execute(dto);
    return toMatchResponse(match);
  }

  @Get('momentum')
  async momentum(
    @Query('competition') competition?: '5v5' | '3v3' | 'challenge',
    @Query('surface') surface?: 'GG' | 'PG',
    @Query('status') status?: 'planned' | 'ongoing' | 'finished' | 'deleted',
  ) {
    const matches = await this.getMomentumMatchesUseCase.execute({
      competitionType: competition,
      surface,
      status,
    });
    return mapMatches(matches);
  }

  // READ ALL
  @Get()
  async findAll(
    @Query('competition') competition?: '5v5' | '3v3' | 'challenge',
    @Query('surface') surface?: 'GG' | 'PG',
    @Query('status') status?: 'planned' | 'ongoing' | 'finished' | 'deleted',
    @Query('teamId') teamId?: string,
    @Query('jour') jour?: 'J1' | 'J2' | 'J3',
  ) {
    const hasFilters = Boolean(
      competition || surface || status || teamId || jour,
    );
    if (hasFilters) {
      const matches = await this.getAllMatchesUseCase.execute({
        competitionType: competition,
        surface,
        status,
        teamId,
        jour,
      });
      return mapMatches(matches);
    }
    const matches = await this.cache.staleWhileRevalidate('matches', () =>
      this.getAllMatchesUseCase.execute({}),
    );
    return mapMatches(matches);
  }

  // READ ONE
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const match = await this.getMatchByIdUseCase.execute(id);
    return match ? toMatchResponse(match) : null;
  }

  // UPDATE
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateMatchDto) {
    const match = await this.updateMatchUseCase.execute(id, dto);
    return match ? toMatchResponse(match) : null;
  }

  // DELETE
  @Delete(':id')
  async delete(@Param('id') id: string, @Body() dto: DeleteMatchDto) {
    return await this.deleteMatchUseCase.execute(id, dto);
  }
}
