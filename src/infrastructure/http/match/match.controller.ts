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

@Controller('matches')
export class MatchController {
  constructor(
    private readonly createMatchUseCase: CreateMatchUseCase,
    private readonly getAllMatchesUseCase: GetAllMatchesUseCase,
    private readonly getMatchByIdUseCase: GetMatchByIdUseCase,
    private readonly updateMatchUseCase: UpdateMatchUseCase,
    private readonly deleteMatchUseCase: DeleteMatchUseCase,
    private readonly getMomentumMatchesUseCase: GetMomentumMatchesUseCase,
  ) {}

  // CREATE
  @Post()
  async create(@Body() dto: CreateMatchDto) {
    return await this.createMatchUseCase.execute(dto);
  }

  @Get('momentum')
  async momentum(
    @Query('competition') competition?: '5v5' | '3v3' | 'challenge',
    @Query('surface') surface?: 'GG' | 'PG',
  ) {
    return this.getMomentumMatchesUseCase.execute({
      competitionType: competition,
      surface,
    });
  }

  // READ ALL
  @Get()
  async findAll(
    @Query('competition') competition?: '5v5' | '3v3' | 'challenge',
    @Query('surface') surface?: 'GG' | 'PG',
    @Query('status') status?: 'planned' | 'ongoing' | 'finished' | 'deleted',
  ) {
    return await this.getAllMatchesUseCase.execute({
      competitionType: competition,
      surface,
      status,
    });
  }

  // READ ONE
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.getMatchByIdUseCase.execute(id);
  }

  // UPDATE
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMatchDto) {
    return await this.updateMatchUseCase.execute(id, dto);
  }

  // DELETE
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Body() dto: DeleteMatchDto,
  ) {
    return await this.deleteMatchUseCase.execute(id, dto);
  }

}
