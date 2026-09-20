import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UploadImageRibUseCase } from './upload-image-rib.usecase';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { IMAGE_RIB_MAX_SIZE_BYTES } from './image-rib.constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRawEdition(overrides: { id?: number } = {}) {
  return {
    id: overrides.id ?? 1,
    nom: 'RCHC U11 2026',
    categorie: 'U11',
    annee: 2026,
    etape: 'INSCRIPTIONS_OUVERTES',
    dateDebut: new Date('2026-01-15'),
    dateFinDebut: new Date('2026-01-15'),
    dateFinFin: new Date('2026-01-16'),
    fraisInscription: 100,
    prixRepas: 15,
    nbPlacesMax: 16,
    imageUrl: null,
    imageDossierUrl: null,
    imageRibUrl: null,
    imageRibData: null,
    imageRibMimeType: null,
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

function makeFile(
  overrides: { mimetype?: string; size?: number } = {},
): { buffer: Buffer; mimetype: string; size: number } {
  const size = overrides.size ?? 1024;
  return {
    buffer: Buffer.alloc(size, 1),
    mimetype: overrides.mimetype ?? 'image/png',
    size,
  };
}

function makePrisma(overrides: {
  findUnique?: jest.Mock;
  update?: jest.Mock;
} = {}): InscriptionPrismaService {
  return {
    inscEdition: {
      findUnique: overrides.findUnique ?? jest.fn(),
      update: overrides.update ?? jest.fn(),
    },
  } as unknown as InscriptionPrismaService;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('UploadImageRibUseCase', () => {
  describe('execute()', () => {
    it('persiste imageRibData/imageRibMimeType/imageRibUpdatedAt pour un fichier valide et retourne hasImageRib=true (AC2)', async () => {
      const findUnique = jest.fn().mockResolvedValue(makeRawEdition({ id: 5 }));
      const update = jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          ...makeRawEdition({ id: 5 }),
          imageRibData: data.imageRibData,
          imageRibMimeType: data.imageRibMimeType,
          imageRibUpdatedAt: data.imageRibUpdatedAt,
          anneesAge: [],
        }),
      );
      const useCase = new UploadImageRibUseCase(makePrisma({ findUnique, update }));

      const result = await useCase.execute(5, makeFile({ mimetype: 'image/png' }));

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5 },
          data: expect.objectContaining({
            imageRibMimeType: 'image/png',
            imageRibUpdatedAt: expect.any(Date),
          }),
          include: { anneesAge: true },
        }),
      );
      expect(result.hasImageRib).toBe(true);
      expect(result.imageRibUpdatedAt).toBeInstanceOf(Date);
    });

    it.each(['image/png', 'image/jpeg', 'image/webp'])(
      'accepte le type MIME %s',
      async (mimetype) => {
        const update = jest
          .fn()
          .mockResolvedValue({ ...makeRawEdition(), anneesAge: [] });
        const useCase = new UploadImageRibUseCase(
          makePrisma({
            findUnique: jest.fn().mockResolvedValue(makeRawEdition()),
            update,
          }),
        );

        await useCase.execute(1, makeFile({ mimetype }));

        expect(update).toHaveBeenCalled();
      },
    );

    it('rejette un type MIME non autorisé avec un 400 explicite, sans modifier la base (AC3)', async () => {
      const update = jest.fn();
      const useCase = new UploadImageRibUseCase(
        makePrisma({
          findUnique: jest.fn().mockResolvedValue(makeRawEdition()),
          update,
        }),
      );

      await expect(
        useCase.execute(1, makeFile({ mimetype: 'application/pdf' })),
      ).rejects.toThrow(BadRequestException);
      expect(update).not.toHaveBeenCalled();
    });

    it('rejette un fichier de plus de 5 Mo avec un 400 explicite, sans modifier la base (AC3)', async () => {
      const update = jest.fn();
      const useCase = new UploadImageRibUseCase(
        makePrisma({
          findUnique: jest.fn().mockResolvedValue(makeRawEdition()),
          update,
        }),
      );

      await expect(
        useCase.execute(
          1,
          makeFile({ size: IMAGE_RIB_MAX_SIZE_BYTES + 1 }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(update).not.toHaveBeenCalled();
    });

    it('accepte un fichier exactement à la limite de taille (5 Mo)', async () => {
      const update = jest
        .fn()
        .mockResolvedValue({ ...makeRawEdition(), anneesAge: [] });
      const useCase = new UploadImageRibUseCase(
        makePrisma({
          findUnique: jest.fn().mockResolvedValue(makeRawEdition()),
          update,
        }),
      );

      await useCase.execute(1, makeFile({ size: IMAGE_RIB_MAX_SIZE_BYTES }));

      expect(update).toHaveBeenCalled();
    });

    it("lève NotFoundException si l'édition n'existe pas, sans écrire en base", async () => {
      const update = jest.fn();
      const useCase = new UploadImageRibUseCase(
        makePrisma({ findUnique: jest.fn().mockResolvedValue(null), update }),
      );

      await expect(useCase.execute(999, makeFile())).rejects.toThrow(
        NotFoundException,
      );
      expect(update).not.toHaveBeenCalled();
    });
  });
});
