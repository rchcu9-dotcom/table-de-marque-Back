export const EDITION_ETAPES = [
  'CREEE',
  'CREATION_NOUVEAU_TOURNOI',
  'INSCRIPTIONS_OUVERTES',
  'CLOTUREE',
  'TOURNOI_DEMARRE',
] as const;

export type EditionEtape = (typeof EDITION_ETAPES)[number];
