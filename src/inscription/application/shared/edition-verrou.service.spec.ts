import { ConflictException, NotFoundException } from '@nestjs/common';
import { EditionVerrouService } from './edition-verrou.service';
import {
  MESSAGE_FORMULE_FIGEE,
  MESSAGE_INSCRIPTION_FIGEE,
} from '../../domain/edition-regles';
import { EDITION_ETAPES } from '../../domain/enums/edition-etape.enum';

function makeService(edition: { etape: string } | null) {
  const findUnique = jest.fn().mockResolvedValue(edition);
  const service = new EditionVerrouService({ inscEdition: { findUnique } } as any);
  return { service, findUnique };
}

describe('EditionVerrouService', () => {
  it("lit uniquement l'étape de l'édition demandée", async () => {
    const { service, findUnique } = makeService({ etape: 'CREEE' });

    await service.assertParametresInscriptionModifiables(7);

    expect(findUnique).toHaveBeenCalledWith({ where: { id: 7 }, select: { etape: true } });
  });

  it.each([
    'assertParametresInscriptionModifiables',
    'assertFormuleSportiveModifiable',
  ] as const)("%s : 404 quand l'édition n'existe pas", async (methode) => {
    const { service } = makeService(null);
    await expect(service[methode](999)).rejects.toThrow(
      new NotFoundException('Édition 999 introuvable'),
    );
  });

  describe('assertParametresInscriptionModifiables', () => {
    it.each(['CREEE', 'CREATION_NOUVEAU_TOURNOI'])('accepte à %s', async (etape) => {
      await expect(
        makeService({ etape }).service.assertParametresInscriptionModifiables(1),
      ).resolves.toBeUndefined();
    });

    it.each(['INSCRIPTIONS_OUVERTES', 'CLOTUREE', 'TOURNOI_DEMARRE'])(
      'refuse en 409 avec le message explicite à %s',
      async (etape) => {
        const promesse = makeService({ etape }).service.assertParametresInscriptionModifiables(1);
        await expect(promesse).rejects.toBeInstanceOf(ConflictException);
        await expect(promesse).rejects.toThrow(MESSAGE_INSCRIPTION_FIGEE);
      },
    );
  });

  describe('assertFormuleSportiveModifiable', () => {
    it.each(EDITION_ETAPES.filter((e) => e !== 'TOURNOI_DEMARRE'))(
      'accepte à %s',
      async (etape) => {
        await expect(
          makeService({ etape }).service.assertFormuleSportiveModifiable(1),
        ).resolves.toBeUndefined();
      },
    );

    it('refuse en 409 avec le message explicite à TOURNOI_DEMARRE', async () => {
      const promesse = makeService({ etape: 'TOURNOI_DEMARRE' }).service.assertFormuleSportiveModifiable(1);
      await expect(promesse).rejects.toBeInstanceOf(ConflictException);
      await expect(promesse).rejects.toThrow(MESSAGE_FORMULE_FIGEE);
    });
  });
});
