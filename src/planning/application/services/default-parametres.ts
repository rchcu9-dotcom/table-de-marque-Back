import { MatriceDelaiMinActivite } from '../../domain/entities/parametres-sportifs.entity';
import { FormatPhaseFinale } from '../../domain/enums/format-phase-finale.enum';

/**
 * Valeurs par défaut du script legacy (docs/specs/planning-j1/planner.ts) et
 * conventions raisonnables pour les paramètres introduits par cette feature
 * (poules/qualif/finale n'existaient pas dans le script de référence).
 * Appliquées uniquement quand le paramètre correspondant est absent en base —
 * jamais silencieusement : le mode de la simulation liste les libellés
 * défaultés (§3 de la spec).
 */

/**
 * Le catalogue d'Activités étant désormais ouvert (plus d'enum figé
 * REPAS/CHALLENGE), les clés de la matrice de délai ne peuvent plus être les
 * littéraux 'repas'/'challenge' — elles sont désormais `String(activiteId)`
 * (clé 'match' conservée telle quelle pour les matchs, qui ne sont pas une
 * ligne du catalogue). Cette fonction ne peut donc être construite qu'une
 * fois les ids des lignes Repas/Challenge du catalogue de l'édition connus
 * (cf. GetActivitesCatalogueUseCase, qui les seed si absentes).
 */
export function buildDefaultMinGap(
  repasActiviteId: number,
  challengeActiviteId: number,
): MatriceDelaiMinActivite {
  const repas = String(repasActiviteId);
  const challenge = String(challengeActiviteId);
  return {
    match: { match: 60, [repas]: 5, [challenge]: 5 },
    [repas]: { match: 45, [repas]: 0, [challenge]: 45 },
    [challenge]: { match: 60, [repas]: 10, [challenge]: 0 },
  };
}

export const DEFAULT_DUREE_INTER_MATCH_MIN = 0;
export const DEFAULT_NB_POULES = 4;
export const DEFAULT_NB_EQUIPES_QUALIFIEES_PAR_POULE = 2;
export const DEFAULT_FORMAT_PHASE_FINALE =
  FormatPhaseFinale.ELIMINATION_DIRECTE;
export const DEFAULT_NB_PATINOIRES = 3;

// Valeurs de seed du catalogue Repas/Challenge à la création d'une édition
// (cf. GetActivitesCatalogueUseCase) — reprises des anciens champs figés
// dureeRepasMin/dureeChallengeParEquipeMin et de NB_TABLES_REPAS (legacy
// PlacementActivitesService).
export const DEFAULT_DUREE_REPAS_MIN = 40;
export const DEFAULT_DUREE_CHALLENGE_MIN = 40;
export const DEFAULT_CAPACITE_PARALLELE_REPAS = 4;
export const DEFAULT_CAPACITE_PARALLELE_CHALLENGE = 1;
