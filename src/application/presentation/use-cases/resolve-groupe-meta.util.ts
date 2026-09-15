import { PresentationArticleRecord } from '@/domain/presentation/repositories/presentation-article.repository';

export type GroupeMeta = {
  groupeOrdre: number;
  groupeDureeMs: number;
  groupeImageUrl: string | null;
};

const DEFAULT_GROUPE_DUREE_MS = 5000;

/**
 * groupeOrdre/groupeDureeMs/groupeImageUrl sont dupliqués sur chaque ligne
 * (pas de table PresentationGroupe dédiée). Quand un article est créé ou
 * déplacé dans un groupe déjà existant, il doit hériter de sa méta actuelle
 * plutôt que de repartir sur des valeurs par défaut qui écraseraient
 * silencieusement la durée/l'image déjà configurées par l'organisateur.
 */
export function resolveGroupeMeta(
  existingArticles: PresentationArticleRecord[],
  groupe: string,
): GroupeMeta {
  const existing = existingArticles.find((a) => a.groupe === groupe);
  if (existing) {
    return {
      groupeOrdre: existing.groupeOrdre,
      groupeDureeMs: existing.groupeDureeMs,
      groupeImageUrl: existing.groupeImageUrl,
    };
  }

  const maxOrdre = existingArticles.reduce(
    (max, a) => Math.max(max, a.groupeOrdre),
    -1,
  );
  return {
    groupeOrdre: maxOrdre + 1,
    groupeDureeMs: DEFAULT_GROUPE_DUREE_MS,
    groupeImageUrl: null,
  };
}
