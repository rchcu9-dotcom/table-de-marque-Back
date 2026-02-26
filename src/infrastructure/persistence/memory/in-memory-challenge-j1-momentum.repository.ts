import {
  ChallengeJ1MomentumEntry,
  ChallengeJ1MomentumRepository,
} from '@/domain/challenge/repositories/challenge-j1-momentum.repository';

export class InMemoryChallengeJ1MomentumRepository
  implements ChallengeJ1MomentumRepository
{
  async findJ1Momentum(): Promise<ChallengeJ1MomentumEntry[]> {
    return [];
  }
}

