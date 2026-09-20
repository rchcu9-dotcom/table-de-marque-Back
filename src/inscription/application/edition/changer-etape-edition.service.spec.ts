import { ConflictException, NotFoundException } from '@nestjs/common';
import { ChangerEtapeEditionService } from './changer-etape-edition.service';
import { OuvrirInscriptionsUseCase } from './ouvrir-inscriptions.usecase';
import { CloturerInscriptionsUseCase } from './cloturer-inscriptions.usecase';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { EDITION_ETAPES } from '../../domain/enums/edition-etape.enum';

function makeRawEdition(overrides: { id?: number; etape?: string } = {}) {
  return {
    id: overrides.id ?? 1,
    nom: 'RCHC U11 2026',
    categorie: 'U11',
    annee: 2026,
    etape: overrides.etape ?? 'INSCRIPTIONS_OUVERTES',
    dateDebut: new Date('2026-05-23'),
    dateFinDebut: new Date('2026-05-24'),
    dateFinFin: null,
    fraisInscription: 100,
    prixRepas: 15,
    nbPlacesMax: 16,
    imageUrl: null,
    imageDossierUrl: null,
    imageRibUrl: null,
    imageRibData: null,
    imageRibUpdatedAt: null,
    contactEmail: null,
    contactPhone: null,
    dureeSurfacageMin: 20,
    dureeMatchPouleMin: 27,
    dureeMatchFinalMin: 33,
    affichagePlanningPublic: false,
    msgBienvenue: null,
    msgFaisonsConnaissance: null,
    msgSelectionEquipe: null,
    msgAjoutEquipe: null,
    msgInscriptionEnCours: null,
    msgInscriptionValidee: null,
    msgLancerDemande: null,
    msgDemandeSoumise: null,
    msgEquipeRefusee: null,
    msgListeAttente: null,
    msgPaiementAttendu: null,
    msgChequeInfo1: null,
    msgChequeInfo2: null,
    msgInscriptionConfirmee: null,
    msgRenseigneJoueurs: null,
    anneesAge: [],
    createdAt: new Date('2025-12-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

function makePrisma(
  overrides: {
    findUnique?: jest.Mock;
    updateMany?: jest.Mock;
    findUniqueOrThrow?: jest.Mock;
  } = {},
) {
  const inscEdition = {
    findUnique: overrides.findUnique ?? jest.fn(),
    updateMany: overrides.updateMany ?? jest.fn(),
    findUniqueOrThrow: overrides.findUniqueOrThrow ?? jest.fn(),
    update: jest.fn(),
  };
  return {
    prisma: { inscEdition } as unknown as InscriptionPrismaService,
    inscEdition,
  };
}

describe('ChangerEtapeEditionService', () => {
  it("lève NotFoundException (404) quand l'édition n'existe pas, sans écrire", async () => {
    const { prisma, inscEdition } = makePrisma({
      findUnique: jest.fn().mockResolvedValue(null),
    });
    const service = new ChangerEtapeEditionService(prisma);

    await expect(service.execute(42, 'CLOTUREE')).rejects.toThrow(
      NotFoundException,
    );
    expect(inscEdition.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['CREEE', 'INSCRIPTIONS_OUVERTES'],
    ['CREATION_NOUVEAU_TOURNOI', 'INSCRIPTIONS_OUVERTES'],
    ['CLOTUREE', 'INSCRIPTIONS_OUVERTES'],
    ['INSCRIPTIONS_OUVERTES', 'CLOTUREE'],
  ] as const)(
    'passe de %s à %s avec une mise à jour conditionnelle sur l\'état lu',
    async (depart, cible) => {
      const { prisma, inscEdition } = makePrisma({
        findUnique: jest.fn().mockResolvedValue(makeRawEdition({ etape: depart })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue(makeRawEdition({ etape: cible })),
      });
      const service = new ChangerEtapeEditionService(prisma);

      const result = await service.execute(1, cible);

      expect(inscEdition.updateMany).toHaveBeenCalledWith({
        where: { id: 1, etape: depart },
        data: { etape: cible },
      });
      expect(inscEdition.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { anneesAge: true },
      });
      expect(result.etape).toBe(cible);
    },
  );

  it("ne renvoie pas dateFinFin dans l'entité retournée", async () => {
    const { prisma } = makePrisma({
      findUnique: jest.fn().mockResolvedValue(makeRawEdition({ etape: 'CLOTUREE' })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue(makeRawEdition({ etape: 'INSCRIPTIONS_OUVERTES' })),
    });
    const service = new ChangerEtapeEditionService(prisma);

    const result = await service.execute(1, 'INSCRIPTIONS_OUVERTES');

    expect(result).not.toHaveProperty('dateFinFin');
  });

  it.each(
    EDITION_ETAPES.flatMap((depart) =>
      (['INSCRIPTIONS_OUVERTES', 'CLOTUREE'] as const)
        .filter(
          (cible) =>
            !(
              (depart === 'CREEE' && cible === 'INSCRIPTIONS_OUVERTES') ||
              (depart === 'CREATION_NOUVEAU_TOURNOI' &&
                cible === 'INSCRIPTIONS_OUVERTES') ||
              (depart === 'INSCRIPTIONS_OUVERTES' && cible === 'CLOTUREE') ||
              (depart === 'CLOTUREE' && cible === 'INSCRIPTIONS_OUVERTES')
            ),
        )
        .map((cible) => [depart, cible] as const),
    ),
  )(
    'lève ConflictException (409) pour %s → %s et n\'écrit rien',
    async (depart, cible) => {
      const { prisma, inscEdition } = makePrisma({
        findUnique: jest.fn().mockResolvedValue(makeRawEdition({ etape: depart })),
      });
      const service = new ChangerEtapeEditionService(prisma);

      await expect(service.execute(1, cible)).rejects.toThrow(
        `Transition d'étape interdite : ${depart} → ${cible}`,
      );
      await expect(service.execute(1, cible)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(inscEdition.updateMany).not.toHaveBeenCalled();
    },
  );

  it("lève ConflictException (409) quand updateMany ne touche aucune ligne (course entre lecture et écriture)", async () => {
    const { prisma, inscEdition } = makePrisma({
      findUnique: jest
        .fn()
        .mockResolvedValue(makeRawEdition({ etape: 'INSCRIPTIONS_OUVERTES' })),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    });
    const service = new ChangerEtapeEditionService(prisma);

    await expect(service.execute(1, 'CLOTUREE')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(inscEdition.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('deux appels concurrents cloturer : un seul réussit, l\'autre reçoit 409', async () => {
    // Simule une base où la clause WHERE etape = <état lu> n'est satisfaite qu'une fois.
    let etapeEnBase = 'INSCRIPTIONS_OUVERTES';
    const { prisma } = makePrisma({
      findUnique: jest
        .fn()
        .mockImplementation(async () => makeRawEdition({ etape: 'INSCRIPTIONS_OUVERTES' })),
      updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
        if (etapeEnBase !== where.etape) return { count: 0 };
        etapeEnBase = data.etape;
        return { count: 1 };
      }),
      findUniqueOrThrow: jest
        .fn()
        .mockImplementation(async () => makeRawEdition({ etape: etapeEnBase })),
    });
    const service = new ChangerEtapeEditionService(prisma);

    const results = await Promise.allSettled([
      service.execute(1, 'CLOTUREE'),
      service.execute(1, 'CLOTUREE'),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);
  });
});

describe('OuvrirInscriptionsUseCase', () => {
  it('délègue au service avec la cible INSCRIPTIONS_OUVERTES', async () => {
    const service = {
      execute: jest.fn().mockResolvedValue({ id: 1 }),
    } as unknown as ChangerEtapeEditionService;

    const result = await new OuvrirInscriptionsUseCase(service).execute(1);

    expect(service.execute).toHaveBeenCalledWith(1, 'INSCRIPTIONS_OUVERTES');
    expect(result).toEqual({ id: 1 });
  });
});

describe('CloturerInscriptionsUseCase', () => {
  it('délègue au service avec la cible CLOTUREE', async () => {
    const service = {
      execute: jest.fn().mockResolvedValue({ id: 1 }),
    } as unknown as ChangerEtapeEditionService;

    const result = await new CloturerInscriptionsUseCase(service).execute(1);

    expect(service.execute).toHaveBeenCalledWith(1, 'CLOTUREE');
    expect(result).toEqual({ id: 1 });
  });
});
