export type ChallengeVitesseJ3Player = {
  id: string;
  name: string;
  teamId: string;
  teamName?: string | null;
  qf?: string | null;
  df?: string | null;
  f?: string | null;
  v?: string | null;
};

export const CHALLENGE_VITESSE_J3_REPOSITORY = Symbol(
  'CHALLENGE_VITESSE_J3_REPOSITORY',
);

export abstract class ChallengeVitesseJ3Repository {
  abstract findAll(): Promise<ChallengeVitesseJ3Player[]>;
}
