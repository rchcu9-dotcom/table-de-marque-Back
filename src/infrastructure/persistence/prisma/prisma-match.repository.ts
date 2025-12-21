import { Injectable } from '@nestjs/common';
import { Match } from '@/domain/match/entities/match.entity';
import { MatchRepository } from '@/domain/match/repositories/match.repository';

@Injectable()
export class PrismaMatchRepository implements MatchRepository {
  create(_match: Match): Promise<Match> {
    return Promise.reject(
      new Error('PrismaMatchRepository not implemented yet.'),
    );
  }

  findAll(): Promise<Match[]> {
    return Promise.reject(
      new Error('PrismaMatchRepository not implemented yet.'),
    );
  }

  findById(_id: string): Promise<Match | null> {
    return Promise.reject(
      new Error('PrismaMatchRepository not implemented yet.'),
    );
  }

  update(_match: Match): Promise<Match> {
    return Promise.reject(
      new Error('PrismaMatchRepository not implemented yet.'),
    );
  }

  delete(_id: string): Promise<void> {
    return Promise.reject(
      new Error('PrismaMatchRepository not implemented yet.'),
    );
  }
}
