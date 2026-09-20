import type { EditionEtape } from './enums/edition-etape.enum';

/**
 * Table des transitions d'étape autorisées d'une édition — source unique.
 * Aucun retour vers CREEE / CREATION_NOUVEAU_TOURNOI ; TOURNOI_DEMARRE est
 * terminal (atteint uniquement via DemarrerTournoiUseCase).
 */
export const TRANSITIONS_ETAPE: Readonly<
  Record<EditionEtape, readonly EditionEtape[]>
> = {
  CREEE: ['INSCRIPTIONS_OUVERTES'],
  CREATION_NOUVEAU_TOURNOI: ['INSCRIPTIONS_OUVERTES'],
  INSCRIPTIONS_OUVERTES: ['CLOTUREE'],
  CLOTUREE: ['INSCRIPTIONS_OUVERTES', 'TOURNOI_DEMARRE'],
  TOURNOI_DEMARRE: [],
};

export function estTransitionAutorisee(
  from: EditionEtape,
  to: EditionEtape,
): boolean {
  return TRANSITIONS_ETAPE[from]?.includes(to) ?? false;
}
