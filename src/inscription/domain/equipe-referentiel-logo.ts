import { buildTeamLogoUrl } from '@/infrastructure/persistence/mysql/mysql-utils';

/**
 * Seule une adresse http(s) est un logo exploitable. Les adresses `blob:`
 * envoyées autrefois par la fenêtre « Ajouter une équipe »
 * (`URL.createObjectURL`) n'existent que dans l'onglet qui les a créées :
 * enregistrées en base, elles donnaient une image cassée pour tous les autres
 * (cas du logo de Dammarie en prod, 2026-10-24).
 */
export function estLogoUrlValide(valeur: string | null | undefined): boolean {
  return /^https?:\/\//i.test((valeur ?? '').trim());
}

/** Valeur à enregistrer : l'adresse si elle est exploitable, sinon `null`. */
export function normaliserLogoUrl(
  valeur: string | null | undefined,
): string | null {
  return estLogoUrlValide(valeur) ? valeur!.trim() : null;
}

/**
 * Logo affiché pour une équipe du référentiel : l'adresse enregistrée si elle
 * est exploitable, sinon le PNG déduit du nom court, comme sur les pages
 * tournoi (`<TEAM_LOGO_BASE_URL>/<slug>.png`).
 */
export function resoudreLogoEquipe(
  logoUrl: string | null | undefined,
  nom: string | null | undefined,
): string | null {
  return normaliserLogoUrl(logoUrl) ?? buildTeamLogoUrl(nom);
}
