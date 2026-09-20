import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SoumettreCanditatureUseCase } from '@/inscription/application/candidature/soumettre-candidature.usecase';
import type { InscriptionPrismaService } from '@/inscription/infrastructure/persistence/inscription-prisma.service';
import { InscriptionStatut } from '@prisma/client';

function makePrisma(overrides: {
  findUniqueUtilisateur?: jest.Mock;
  findFirstEdition?: jest.Mock;
  findFirstInscription?: jest.Mock;
  findUniqueEquipe?: jest.Mock;
  findUniqueInscription?: jest.Mock;
  createInscription?: jest.Mock;
}): InscriptionPrismaService {
  return {
    inscUtilisateur: { findUnique: overrides.findUniqueUtilisateur ?? jest.fn() },
    inscEdition: { findFirst: overrides.findFirstEdition ?? jest.fn() },
    inscInscription: {
      findFirst: overrides.findFirstInscription ?? jest.fn(),
      findUnique: overrides.findUniqueInscription ?? jest.fn(),
      create: overrides.createInscription ?? jest.fn(),
    },
    inscEquipeReferentiel: { findUnique: overrides.findUniqueEquipe ?? jest.fn() },
  } as unknown as InscriptionPrismaService;
}

const EDITION_OUVERTE = {
  id: 10,
};

describe('SoumettreCanditatureUseCase', () => {
  const dto = { equipeRefId: 5 };

  it('throws NotFoundException when no InscUtilisateur matches the firebase uid', async () => {
    const prisma = makePrisma({
      findUniqueUtilisateur: jest.fn().mockResolvedValue(null),
    });
    const useCase = new SoumettreCanditatureUseCase(prisma);

    await expect(useCase.execute('inconnu-1', dto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws BadRequestException when no edition is INSCRIPTIONS_OUVERTES', async () => {
    const prisma = makePrisma({
      findUniqueUtilisateur: jest.fn().mockResolvedValue({ id: 1 }),
      findFirstEdition: jest.fn().mockResolvedValue(null),
    });
    const useCase = new SoumettreCanditatureUseCase(prisma);

    await expect(useCase.execute('user-1', dto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('queries inscEdition.findFirst with where.etape set to INSCRIPTIONS_OUVERTES (regression: array-destructuring bug)', async () => {
    const findFirstEdition = jest.fn().mockResolvedValue(EDITION_OUVERTE);
    const prisma = makePrisma({
      findUniqueUtilisateur: jest.fn().mockResolvedValue({ id: 1 }),
      findFirstEdition,
      findFirstInscription: jest.fn().mockResolvedValue(null),
      findUniqueEquipe: jest.fn().mockResolvedValue({ id: 5, nom: 'Equipe A', active: true }),
      findUniqueInscription: jest.fn().mockResolvedValue(null),
      createInscription: jest.fn().mockResolvedValue({
        id: 1,
        equipeNom: 'Equipe A',
        statut: InscriptionStatut.CANDIDATE,
        createdAt: new Date('2026-01-01'),
      }),
    });
    const useCase = new SoumettreCanditatureUseCase(prisma);

    await useCase.execute('user-1', dto);

    expect(findFirstEdition).toHaveBeenCalledWith({
      where: { etape: 'INSCRIPTIONS_OUVERTES' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it.each([
    ['dateFinFin passée', { id: 10, dateFinFin: new Date('2020-01-01') }],
    ['dateFinFin NULL', { id: 10, dateFinFin: null }],
    ['dateFinFin absente', { id: 10 }],
  ])(
    'accepte une candidature sur une édition INSCRIPTIONS_OUVERTES quelle que soit la date de fin (%s) — etape est la seule garde',
    async (_label, edition) => {
      const createInscription = jest.fn().mockResolvedValue({
        id: 1,
        equipeNom: 'Equipe A',
        statut: InscriptionStatut.CANDIDATE,
        createdAt: new Date('2026-01-01'),
      });
      const prisma = makePrisma({
        findUniqueUtilisateur: jest.fn().mockResolvedValue({ id: 1 }),
        findFirstEdition: jest.fn().mockResolvedValue(edition),
        findFirstInscription: jest.fn().mockResolvedValue(null),
        findUniqueEquipe: jest
          .fn()
          .mockResolvedValue({ id: 5, nom: 'Equipe A', active: true }),
        findUniqueInscription: jest.fn().mockResolvedValue(null),
        createInscription,
      });
      const useCase = new SoumettreCanditatureUseCase(prisma);

      await expect(useCase.execute('user-1', dto)).resolves.toMatchObject({
        id: 1,
        statut: InscriptionStatut.CANDIDATE,
      });
      expect(createInscription).toHaveBeenCalledTimes(1);
    },
  );

  it('throws ConflictException when the user already has an inscription for this edition', async () => {
    const prisma = makePrisma({
      findUniqueUtilisateur: jest.fn().mockResolvedValue({ id: 1 }),
      findFirstEdition: jest.fn().mockResolvedValue(EDITION_OUVERTE),
      findFirstInscription: jest.fn().mockResolvedValue({ id: 99 }),
    });
    const useCase = new SoumettreCanditatureUseCase(prisma);

    await expect(useCase.execute('user-1', dto)).rejects.toThrow(
      ConflictException,
    );
  });

  it('throws NotFoundException when the equipe referentiel does not exist', async () => {
    const prisma = makePrisma({
      findUniqueUtilisateur: jest.fn().mockResolvedValue({ id: 1 }),
      findFirstEdition: jest.fn().mockResolvedValue(EDITION_OUVERTE),
      findFirstInscription: jest.fn().mockResolvedValue(null),
      findUniqueEquipe: jest.fn().mockResolvedValue(null),
    });
    const useCase = new SoumettreCanditatureUseCase(prisma);

    await expect(useCase.execute('user-1', dto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws BadRequestException when the equipe referentiel is not active', async () => {
    const prisma = makePrisma({
      findUniqueUtilisateur: jest.fn().mockResolvedValue({ id: 1 }),
      findFirstEdition: jest.fn().mockResolvedValue(EDITION_OUVERTE),
      findFirstInscription: jest.fn().mockResolvedValue(null),
      findUniqueEquipe: jest.fn().mockResolvedValue({ id: 5, nom: 'Equipe A', active: false }),
    });
    const useCase = new SoumettreCanditatureUseCase(prisma);

    await expect(useCase.execute('user-1', dto)).rejects.toThrow(
      BadRequestException,
    );
  });

  const MESSAGE_EQUIPE_INDISPONIBLE =
    'Cette équipe ne peut pas être sélectionnée pour le moment.';

  it.each([
    InscriptionStatut.CANDIDATE,
    InscriptionStatut.LISTE_ATTENTE,
    InscriptionStatut.RESERVEE,
    InscriptionStatut.PAIEMENT_ATTENDU,
    InscriptionStatut.VALIDEE,
    InscriptionStatut.DOSSIER_EN_COURS,
    InscriptionStatut.DOSSIER_COMPLET,
    InscriptionStatut.REFUSEE,
  ])(
    'throws ConflictException with the same generic message regardless of the existing inscription statut (%s) — AC1, AC2, AC6',
    async (statutExistant) => {
      const prisma = makePrisma({
        findUniqueUtilisateur: jest.fn().mockResolvedValue({ id: 1 }),
        findFirstEdition: jest.fn().mockResolvedValue(EDITION_OUVERTE),
        findFirstInscription: jest.fn().mockResolvedValue(null),
        findUniqueEquipe: jest
          .fn()
          .mockResolvedValue({ id: 5, nom: 'Equipe A', active: true }),
        findUniqueInscription: jest
          .fn()
          .mockResolvedValue({ statut: statutExistant }),
      });
      const useCase = new SoumettreCanditatureUseCase(prisma);

      await expect(useCase.execute('user-1', dto)).rejects.toThrow(
        ConflictException,
      );
      await expect(useCase.execute('user-1', dto)).rejects.toThrow(
        MESSAGE_EQUIPE_INDISPONIBLE,
      );
    },
  );

  it('never surfaces the existing inscription statut in the error message (non-distinguishability, AC1, AC2)', async () => {
    const messages = await Promise.all(
      [InscriptionStatut.CANDIDATE, InscriptionStatut.DOSSIER_COMPLET].map(
        async (statut) => {
          const prisma = makePrisma({
            findUniqueUtilisateur: jest.fn().mockResolvedValue({ id: 1 }),
            findFirstEdition: jest.fn().mockResolvedValue(EDITION_OUVERTE),
            findFirstInscription: jest.fn().mockResolvedValue(null),
            findUniqueEquipe: jest
              .fn()
              .mockResolvedValue({ id: 5, nom: 'Equipe A', active: true }),
            findUniqueInscription: jest.fn().mockResolvedValue({ statut }),
          });
          const useCase = new SoumettreCanditatureUseCase(prisma);
          try {
            await useCase.execute('user-1', dto);
            throw new Error('expected ConflictException');
          } catch (e) {
            return (e as ConflictException).message;
          }
        },
      ),
    );

    expect(messages[0]).toBe(messages[1]);
    expect(messages[0]).toBe(MESSAGE_EQUIPE_INDISPONIBLE);
  });

  it('creates the inscription with statut CANDIDATE when all checks pass', async () => {
    const createInscription = jest.fn().mockResolvedValue({
      id: 42,
      equipeNom: 'Equipe A',
      statut: InscriptionStatut.CANDIDATE,
      createdAt: new Date('2026-01-01'),
    });
    const prisma = makePrisma({
      findUniqueUtilisateur: jest.fn().mockResolvedValue({ id: 1 }),
      findFirstEdition: jest.fn().mockResolvedValue(EDITION_OUVERTE),
      findFirstInscription: jest.fn().mockResolvedValue(null),
      findUniqueEquipe: jest.fn().mockResolvedValue({ id: 5, nom: 'Equipe A', active: true }),
      findUniqueInscription: jest.fn().mockResolvedValue(null),
      createInscription,
    });
    const useCase = new SoumettreCanditatureUseCase(prisma);

    const result = await useCase.execute('user-1', dto);

    expect(createInscription).toHaveBeenCalledWith({
      data: {
        editionId: 10,
        utilisateurId: 1,
        equipeRefId: 5,
        equipeNom: 'Equipe A',
        statut: InscriptionStatut.CANDIDATE,
      },
    });
    expect(result.id).toBe(42);
  });
});
