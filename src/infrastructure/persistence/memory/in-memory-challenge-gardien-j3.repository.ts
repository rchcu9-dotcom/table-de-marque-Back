import { Injectable } from '@nestjs/common';
import {
  ChallengeGardienJ3Player,
  ChallengeGardienJ3Repository,
} from '@/domain/challenge/repositories/challenge-gardien-j3.repository';

@Injectable()
export class InMemoryChallengeGardienJ3Repository
  implements ChallengeGardienJ3Repository
{
  async findAll(): Promise<ChallengeGardienJ3Player[]> {
    return [];
  }
}
