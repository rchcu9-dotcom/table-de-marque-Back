import { Injectable } from '@nestjs/common';
import { Match } from '@/domain/match/entities/match.entity';
import { MatchRepository } from '@/domain/match/repositories/match.repository';

@Injectable()
export class PrismaMatchRepository implements MatchRepository {
  async create(match: Match): Promise<Match> {
    throw new Error('PrismaMatchRepository not implemented yet.');
  }

  async findAll(): Promise<Match[]> {
    throw new Error('PrismaMatchRepository not implemented yet.');
  }

  async findById(id: string): Promise<Match | null> {
    throw new Error('PrismaMatchRepository not implemented yet.');
  }

  async update(match: Match): Promise<Match> {
    throw new Error('PrismaMatchRepository not implemented yet.');
  }
}
