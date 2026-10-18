/**
 * Qui agit sur un dossier, et sur quel dossier.
 *
 * - REFERENT : le dossier est celui de la dernière candidature de
 *   l'utilisateur connecté (résolu via son uid).
 * - ORGANISATEUR : le dossier est désigné explicitement par l'id de la
 *   candidature (routes `inscription/dossier/candidature/:id/...`).
 *
 * Le rôle conditionne aussi le verrou DOSSIER_COMPLET (cf.
 * DossierAccessService.assertDossierModifiable).
 */
export type DossierActeur =
  | { role: 'REFERENT'; providerUid: string }
  | { role: 'ORGANISATEUR'; candidatureId: number };

export type RoleDossier = DossierActeur['role'];

export const referent = (providerUid: string): DossierActeur => ({
  role: 'REFERENT',
  providerUid,
});

export const organisateur = (candidatureId: number): DossierActeur => ({
  role: 'ORGANISATEUR',
  candidatureId,
});
