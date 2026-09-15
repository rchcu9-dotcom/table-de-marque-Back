export const POSTES_JOUEUR = ['D', 'DEF', 'ATT'] as const;

export type PosteJoueur = (typeof POSTES_JOUEUR)[number];
