import type { DossierAccessService } from '@/inscription/application/dossier/dossier-access.service';
import type { DossierActeur } from '@/inscription/application/dossier/dossier-acteur';

/**
 * Les use cases d'écriture passent par getInscriptionModifiable(acteur).
 * Pour les doubles de test existants (qui mockent la résolution référent et
 * le verrou séparément), on recompose cette méthode à partir des deux mocks,
 * afin de garder chaque test centré sur son cas.
 */
export function withGetInscriptionModifiable(
  access: Record<string, unknown>,
): DossierAccessService {
  const a = access as {
    getInscriptionActivePourUtilisateur: (uid: string) => Promise<unknown>;
    assertDossierModifiable: (i: unknown, role: string) => unknown;
  };
  return {
    ...access,
    getInscriptionModifiable: jest.fn(async (acteur: DossierActeur) => {
      if (acteur.role !== 'REFERENT') {
        throw new Error('double de test limité au référent');
      }
      const inscription = await a.getInscriptionActivePourUtilisateur(
        acteur.providerUid,
      );
      await a.assertDossierModifiable(inscription, acteur.role);
      return inscription;
    }),
  } as unknown as DossierAccessService;
}
