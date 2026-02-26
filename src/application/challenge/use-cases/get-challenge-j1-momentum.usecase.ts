import { Inject, Injectable } from '@nestjs/common';
import {
  CHALLENGE_J1_MOMENTUM_REPOSITORY,
  ChallengeJ1MomentumRepository,
} from '@/domain/challenge/repositories/challenge-j1-momentum.repository';

export type ChallengeJ1MomentumResponseItem = {
  teamId: string;
  teamName: string;
  teamLogoUrl: string | null;
  slotStart: Date;
  slotEnd: Date;
  status: 'planned' | 'ongoing' | 'finished';
  startedAt: Date | null;
  finishedAt: Date | null;
};

@Injectable()
export class GetChallengeJ1MomentumUseCase {
  constructor(
    @Inject(CHALLENGE_J1_MOMENTUM_REPOSITORY)
    private readonly repository: ChallengeJ1MomentumRepository,
  ) {}

  async execute(): Promise<ChallengeJ1MomentumResponseItem[]> {
    return this.repository.findJ1Momentum();
  }
}
