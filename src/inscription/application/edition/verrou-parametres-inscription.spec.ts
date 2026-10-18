import { ConflictException } from '@nestjs/common';
import { EditionVerrouService } from '../shared/edition-verrou.service';
import { MESSAGE_INSCRIPTION_FIGEE } from '../../domain/edition-regles';
import { EDITION_ETAPES, type EditionEtape } from '../../domain/enums/edition-etape.enum';
import { dependanceEspionne } from '../../../../test/support/edition-verrou.mock';
import { UpdateEditionUseCase } from './update-edition.usecase';
import { AjouterAnneeAgeUseCase } from './ajouter-annee-age.usecase';
import { RetirerAnneeAgeUseCase } from './retirer-annee-age.usecase';
import { UploadImageRibUseCase } from './upload-image-rib.usecase';
import { DeleteImageRibUseCase } from './delete-image-rib.usecase';

/**
 * Matrice étape × use case d'écriture des paramètres d'inscription (spec § 2.2,
 * CA 4 et 6), avec le vrai EditionVerrouService sur une étape simulée.
 */
const EDITION_ID = 42;

type Cas = [string, (prisma: any, verrou: EditionVerrouService) => { execute: (...a: any[]) => Promise<unknown> }, unknown[]];

const USE_CASES: Cas[] = [
  ['PATCH editions/:id', (p, v) => new UpdateEditionUseCase(p, v), [EDITION_ID, { nom: 'X' }]],
  ['POST editions/:id/annees-age', (p, v) => new AjouterAnneeAgeUseCase(p, v), [EDITION_ID, { annee: 2016 }]],
  ['DELETE editions/:id/annees-age/:annee', (p, v) => new RetirerAnneeAgeUseCase(p, v), [EDITION_ID, 2016]],
  [
    'POST editions/:id/image-rib',
    (p, v) => new UploadImageRibUseCase(p, v),
    [EDITION_ID, { buffer: Buffer.from('x'), mimetype: 'image/png', size: 1, originalname: 'rib.png' }],
  ],
  ['DELETE editions/:id/image-rib', (p, v) => new DeleteImageRibUseCase(p, v), [EDITION_ID]],
];

const FIGEES: EditionEtape[] = ['INSCRIPTIONS_OUVERTES', 'CLOTUREE', 'TOURNOI_DEMARRE'];
const MODIFIABLES = EDITION_ETAPES.filter((e) => !FIGEES.includes(e));

function monter(fabrique: Cas[1], etape: EditionEtape) {
  const findUnique = jest.fn().mockResolvedValue({ etape });
  const verrou = new EditionVerrouService({ inscEdition: { findUnique } } as any);
  const { dep, appels } = dependanceEspionne();
  return { useCase: fabrique(dep, verrou), appels, findUnique };
}

describe("Verrou des paramètres d'inscription par étape", () => {
  describe.each(USE_CASES)('%s', (_route, fabrique, args) => {
    it.each(FIGEES)('409 à %s, sans aucune lecture ni écriture', async (etape) => {
      const { useCase, appels, findUnique } = monter(fabrique, etape);

      const promesse = useCase.execute(...args);

      await expect(promesse).rejects.toBeInstanceOf(ConflictException);
      await expect(promesse).rejects.toThrow(MESSAGE_INSCRIPTION_FIGEE);
      expect(findUnique).toHaveBeenCalledWith({ where: { id: EDITION_ID }, select: { etape: true } });
      expect(appels).toEqual([]);
    });

    it.each(MODIFIABLES)('passe le garde à %s', async (etape) => {
      const { useCase, appels, findUnique } = monter(fabrique, etape);

      // Les dépendances espionnes ne renvoient rien : le use case peut échouer
      // plus loin, mais jamais sur le garde.
      const erreur = await useCase.execute(...args).then(
        () => null,
        (e: unknown) => e,
      );

      expect(findUnique).toHaveBeenCalledTimes(1);
      expect(erreur instanceof ConflictException && erreur.message === MESSAGE_INSCRIPTION_FIGEE).toBe(false);
      expect(appels.length).toBeGreaterThan(0);
    });
  });
});
