/**
 * Noms d'une équipe du référentiel
 * (docs/specs/-prise-en-compte-du-nom-court-pour-les-logos-contexte-actuel.md).
 * `nom` est le nom court : identifiant fonctionnel, unique, seule source du nom
 * de fichier de logo. `nomComplet` est le nom officiel long, purement informatif.
 *
 * Règles d'écriture communes aux deux champs
 * (docs/specs/-correction-des-anomalies-dans-la-liste-contexte-dans-la-lis.md §2) :
 * pas d'espace parasite, pas d'emoji. La casse n'est jamais modifiée.
 */
/** `insc_equipes_referentiel.nom` : VARCHAR(100). */
export const NOM_COURT_MAX = 100;
export const NOM_COMPLET_MAX = 150;

export const MESSAGE_NOM_SANS_EMOJI = "Le nom ne doit pas contenir d'emoji";
export const MESSAGE_NOM_OBLIGATOIRE = 'Le nom est obligatoire';
export const MESSAGE_NOM_COURT_VERROUILLE =
  'Le nom court ne peut plus être modifié : une candidature fait référence à cette équipe';

// Pictogrammes étendus + indicateurs régionaux : `Extended_Pictographic` seul
// laisse passer les drapeaux (🇫🇷). Chiffres, `#` et `*` ne sont pas concernés.
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u;
// Emoji et ce qui les accompagne sans être visible seul : liant (ZWJ), sélecteur
// de variante, touche combinante, modificateurs de teinte. En alternative plutôt
// qu'en classe : ces caractères combinants sont trompeurs dans une classe.
const EMOJI_ET_LIANTS =
  /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u{200D}|\u{FE0F}|\u{20E3}|[\u{1F3FB}-\u{1F3FF}]/gu;

/** Trim et réduction des suites d'espaces (tout blanc Unicode) à un seul espace. */
export function normaliserEspaces(valeur: string): string {
  return valeur.replace(/\s+/g, ' ').trim();
}

/** Pictogrammes étendus et indicateurs régionaux (drapeaux). */
export function contientEmoji(valeur: string): boolean {
  return EMOJI.test(valeur);
}

/** Retire les emoji et leurs liants, puis `normaliserEspaces`. */
export function retirerEmoji(valeur: string): string {
  return normaliserEspaces(valeur.replace(EMOJI_ET_LIANTS, ' '));
}

/** Espaces normalisés ; vide ou égal à `nom` (casse ignorée) → null. */
export function normaliserNomComplet(
  nom: string,
  nomComplet: string | null | undefined,
): string | null {
  const valeur = normaliserEspaces(nomComplet ?? '');
  if (!valeur) return null;
  if (valeur.toLowerCase() === normaliserEspaces(nom).toLowerCase())
    return null;
  return valeur;
}

/**
 * Renommage du nom court : toute différence après normalisation des espaces,
 * casse et accents compris — la valeur est recopiée telle quelle dans
 * `insc_inscriptions.equipe_nom`.
 */
export function estRenommage(nomActuel: string, nomDemande: string): boolean {
  return normaliserEspaces(nomActuel) !== normaliserEspaces(nomDemande);
}
