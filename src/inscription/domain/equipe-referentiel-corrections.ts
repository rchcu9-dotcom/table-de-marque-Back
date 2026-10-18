import { retirerEmoji } from './equipe-referentiel-noms';

/**
 * Corrections ponctuelles des libellés du référentiel des équipes
 * (docs/specs/-correction-des-anomalies-dans-la-liste-contexte-dans-la-lis.md §1).
 *
 * Corrections de données datées, PAS des règles d'écriture : elles servent aux
 * scripts de reprise et ne doivent jamais être appliquées à une saisie (voir
 * `equipe-referentiel-noms.ts` pour ce qui s'applique à la création).
 */
export type ChampNom = 'nom' | 'nomComplet';

// Le nom long s'aligne sur le nom court « Dammarie » (deux « m »).
const DAMARIE = /\bDamarie\b/g;

const LIBELLES_EXACTS: ReadonlyMap<string, string> = new Map([
  ['Les Belougas De Toulouse Blagnac', 'Les Belougas de Toulouse Blagnac'],
]);

/** Dans l'ordre : emoji retirés, espaces normalisés, Damarie → Dammarie, libellés exacts. */
export function corrigerLibelle(valeur: string): string {
  const propre = retirerEmoji(valeur).replace(DAMARIE, 'Dammarie');
  return LIBELLES_EXACTS.get(propre) ?? propre;
}
