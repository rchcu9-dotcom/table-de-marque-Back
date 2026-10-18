import { ConflictException, NotFoundException } from '@nestjs/common';
import { RevenirEnPreparationUseCase } from './revenir-en-preparation.usecase';
import { ChangerEtapeEditionService } from './changer-etape-edition.service';
import { MESSAGE_RETOUR_AVEC_CANDIDATURES } from '../../domain/edition-regles';

const CREATED_AT = new Date('2027-01-10T00:00:00Z');

function rawEdition(etape: string) {
  return {
    id: 5,
    nom: 'RCHC U11 2027',
    categorie: 'U11',
    annee: 2027,
    etape,
    createdAt: CREATED_AT,
    dateDebut: new Date('2027-05-22'),
    dateFinDebut: new Date('2027-05-23'),
    fraisInscription: 100,
    prixRepas: 15,
    nbPlacesMax: 16,
    affichagePlanningPublic: false,
    anneesAge: [],
  };
}

/**
 * Prisma simulé, avec le vrai ChangerEtapeEditionService : on vérifie la cible
 * réellement écrite par l'updateMany conditionnel.
 */
function makeUseCase({
  etape = 'INSCRIPTIONS_OUVERTES',
  existe = true,
  nbCandidatures = 0,
  nbEditionsAnterieures = 0,
  updateCount = 1,
}: {
  etape?: string;
  existe?: boolean;
  nbCandidatures?: number;
  nbEditionsAnterieures?: number;
  updateCount?: number;
} = {}) {
  let etapeCourante = etape;
  const prisma = {
    inscEdition: {
      findUnique: jest.fn(async () => (existe ? rawEdition(etapeCourante) : null)),
      count: jest.fn().mockResolvedValue(nbEditionsAnterieures),
      updateMany: jest.fn(async ({ data }: { data: { etape: string } }) => {
        if (updateCount > 0) etapeCourante = data.etape;
        return { count: updateCount };
      }),
      findUniqueOrThrow: jest.fn(async () => rawEdition(etapeCourante)),
    },
    inscInscription: { count: jest.fn().mockResolvedValue(nbCandidatures) },
  };
  const useCase = new RevenirEnPreparationUseCase(
    prisma as any,
    new ChangerEtapeEditionService(prisma as any),
  );
  return { useCase, prisma };
}

describe('RevenirEnPreparationUseCase', () => {
  it("404 quand l'édition n'existe pas", async () => {
    const { useCase, prisma } = makeUseCase({ existe: false });

    await expect(useCase.execute(5)).rejects.toThrow(NotFoundException);
    expect(prisma.inscEdition.updateMany).not.toHaveBeenCalled();
  });

  it.each(['CREEE', 'CREATION_NOUVEAU_TOURNOI', 'CLOTUREE', 'TOURNOI_DEMARRE'])(
    '409 depuis %s, sans écriture',
    async (etape) => {
      const { useCase, prisma } = makeUseCase({ etape });

      await expect(useCase.execute(5)).rejects.toThrow(
        new ConflictException(`Transition d'étape interdite : ${etape} → Préparation`),
      );
      expect(prisma.inscEdition.updateMany).not.toHaveBeenCalled();
    },
  );

  it("409 dès qu'une candidature existe (tous statuts), sans écriture", async () => {
    const { useCase, prisma } = makeUseCase({ nbCandidatures: 1 });

    await expect(useCase.execute(5)).rejects.toThrow(
      new ConflictException(MESSAGE_RETOUR_AVEC_CANDIDATURES),
    );
    expect(prisma.inscInscription.count).toHaveBeenCalledWith({ where: { editionId: 5 } });
    expect(prisma.inscEdition.updateMany).not.toHaveBeenCalled();
  });

  it('revient à CREEE sans édition antérieure', async () => {
    const { useCase, prisma } = makeUseCase({ nbEditionsAnterieures: 0 });

    const edition = await useCase.execute(5);

    expect(prisma.inscEdition.count).toHaveBeenCalledWith({
      where: { id: { not: 5 }, createdAt: { lt: CREATED_AT } },
    });
    expect(prisma.inscEdition.updateMany).toHaveBeenCalledWith({
      where: { id: 5, etape: 'INSCRIPTIONS_OUVERTES' },
      data: { etape: 'CREEE' },
    });
    expect(edition.etape).toBe('CREEE');
  });

  it('revient à CREATION_NOUVEAU_TOURNOI quand une édition plus ancienne existe (cycle annuel)', async () => {
    const { useCase, prisma } = makeUseCase({ nbEditionsAnterieures: 2 });

    const edition = await useCase.execute(5);

    expect(prisma.inscEdition.updateMany).toHaveBeenCalledWith({
      where: { id: 5, etape: 'INSCRIPTIONS_OUVERTES' },
      data: { etape: 'CREATION_NOUVEAU_TOURNOI' },
    });
    expect(edition.etape).toBe('CREATION_NOUVEAU_TOURNOI');
  });

  it("409 quand l'étape a changé entre la lecture et l'écriture (count === 0)", async () => {
    const { useCase } = makeUseCase({ updateCount: 0 });

    await expect(useCase.execute(5)).rejects.toBeInstanceOf(ConflictException);
  });
});
