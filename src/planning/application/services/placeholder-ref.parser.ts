const POULE_REF_PATTERN = /^placeholder:poule-([A-Z]+)-rang-(\d+)$/;
const GROUPE_REF_PATTERN = /^placeholder:groupe-(\d+)-rang-(\d+)$/;

export type PoulePlaceholder = { pouleCode: string; rangPoule: number };
export type GroupePlaceholder = { groupeId: number; rang: number };

/**
 * Décompose une ref `placeholder:poule-{X}-rang-{N}` en poule/rang.
 * Retourne `null` si la ref n'a pas cette forme (ex. ref déjà résolue ou
 * ref de vainqueur de bracket `placeholder:vainqueur-tT-mM` — celle-ci ne
 * porte pas elle-même son numéro de match source : il est retrouvé via
 * `MatchGenere.refVainqueurProduit` au moment de l'écriture des matchs,
 * pas par décomposition de la ref).
 */
export function parsePoulePlaceholder(ref: string): PoulePlaceholder | null {
  const match = POULE_REF_PATTERN.exec(ref);
  if (!match) return null;
  return { pouleCode: match[1], rangPoule: Number(match[2]) };
}

/**
 * Décompose une ref `placeholder:groupe-{groupeId}-rang-{N}` généralisée.
 * Retourne `null` si la ref n'a pas cette forme.
 * Produite par `GenerationMatchsGrapheService` pour les matchs de bracket
 * et de qualification au sens large.
 */
export function parseGroupePlaceholder(ref: string): GroupePlaceholder | null {
  const match = GROUPE_REF_PATTERN.exec(ref);
  if (!match) return null;
  return { groupeId: Number(match[1]), rang: Number(match[2]) };
}
