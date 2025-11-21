import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { MatchRepository } from '../../../domain/match/repositories/match.repository';
import { Match } from '../../../domain/match/entities/match.entity';

@Injectable()
export class PrismaMatchRepository implements MatchRepository {
  constructor(private prisma: PrismaService) {}

  async create(match: Match): Promise<Match> {
    const record = await this.prisma.match.create({
      data: {
        id: match.id,
        date: match.date,
        teamA: match.teamA,
        teamB: match.teamB,
        status: match.status,
      },
    });

    return new Match(record.id, record.date, record.teamA, record.teamB, record.status as any);
  }

  async findAll(): Promise<Match[]> {
    const records = await this.prisma.match.findMany();

    return records.map(
      r => new Match(r.id, r.date, r.teamA, r.teamB, r.status as any),
    );
  }
}
