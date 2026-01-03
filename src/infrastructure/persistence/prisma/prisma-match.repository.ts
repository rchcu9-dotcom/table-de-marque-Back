/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { Match } from '@/domain/match/entities/match.entity';
import { MatchRepository } from '@/domain/match/repositories/match.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaMatchRepository implements MatchRepository {
  constructor(private readonly prisma: PrismaService) {}

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

  async delete(id: string): Promise<void> {
    // No-op: Prisma repository inactive for now
    return;
  }
}
