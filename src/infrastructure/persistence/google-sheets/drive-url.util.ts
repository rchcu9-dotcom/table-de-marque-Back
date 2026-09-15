/**
 * Convertit un lien de partage Google Drive (drive.google.com/file/d/<id>/view) en URL
 * affichable comme src d'image. Copie volontaire de la logique déjà présente (méthode
 * privée normalizeDriveUrl) dans google-sheets-public-csv.repository.ts — dupliquée
 * plutôt que refactorée, cf. décision d'architecture journalisée dans docs/specs.
 */
export function normalizeDriveUrl(url: string, size = 600): string {
  const match = url.match(/\/file\/d\/([^/]+)\//);
  if (match && match[1]) {
    const id = match[1];
    return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
  }
  return url;
}

/**
 * Extrait l'id de fichier d'une URL Google Drive, qu'elle soit un lien de partage
 * (`/file/d/<id>/view`) ou déjà convertie en lien thumbnail (`thumbnail?id=<id>&sz=...`,
 * le format déjà stocké tel quel pour les lignes existantes de presentation_articles).
 * Retourne null si l'URL ne ressemble à aucun des deux formats (ex. une image hébergée
 * ailleurs) — l'appelant doit alors laisser l'URL telle quelle plutôt que la proxifier.
 */
export function extractDriveFileId(url: string): string | null {
  const shareMatch = url.match(/\/file\/d\/([^/]+)\//);
  if (shareMatch && shareMatch[1]) return shareMatch[1];

  if (url.includes('drive.google.com/thumbnail')) {
    const idMatch = url.match(/[?&]id=([^&]+)/);
    if (idMatch && idMatch[1]) return idMatch[1];
  }

  return null;
}
