export type ChallengeGardienJ3Player = {
  id: string;
  name: string;
  teamId: string;
  teamName?: string | null;
  df?: string | null;
  f?: string | null;
  v?: string | null;
};

export const CHALLENGE_GARDIEN_J3_REPOSITORY = Symbol(
  'CHALLENGE_GARDIEN_J3_REPOSITORY',
);

export abstract class ChallengeGardienJ3Repository {
  abstract findAll(): Promise<ChallengeGardienJ3Player[]>;
}
