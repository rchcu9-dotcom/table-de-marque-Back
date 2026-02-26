export type ChallengeJ1MomentumEntry = {
  teamId: string;
  teamName: string;
  teamLogoUrl: string | null;
  slotStart: Date;
  slotEnd: Date;
  status: 'planned' | 'ongoing' | 'finished';
  startedAt: Date | null;
  finishedAt: Date | null;
};

export const CHALLENGE_J1_MOMENTUM_REPOSITORY = Symbol(
  'CHALLENGE_J1_MOMENTUM_REPOSITORY',
);

export abstract class ChallengeJ1MomentumRepository {
  abstract findJ1Momentum(): Promise<ChallengeJ1MomentumEntry[]>;
}
