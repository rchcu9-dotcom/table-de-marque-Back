import { NotFoundException } from '@nestjs/common';
import { AjouterCoachUseCase } from '@/inscription/application/dossier/ajouter-coach.usecase';
import { ModifierCoachUseCase } from '@/inscription/application/dossier/modifier-coach.usecase';
import { SupprimerCoachUseCase } from '@/inscription/application/dossier/supprimer-coach.usecase';
import type { InscriptionPrismaService } from '@/inscription/infrastructure/persistence/inscription-prisma.service';
import type { DossierAccessService } from '@/inscription/application/dossier/dossier-access.service';
import { InscriptionStatut } from '@prisma/client';

const INSCRIPTION_EN_COURS = { id: 100, statut: InscriptionStatut.DOSSIER_EN_COURS };

function makeDossierAccess(overrides: {
  assurerDossierEnCours?: jest.Mock;
}): DossierAccessService {
  return {
    getInscriptionActivePourUtilisateur: jest
      .fn()
      .mockResolvedValue(INSCRIPTION_EN_COURS),
    assertDossierModifiable: jest.fn(),
    assurerDossierEnCours:
      overrides.assurerDossierEnCours ?? jest.fn().mockResolvedValue(5),
  } as unknown as DossierAccessService;
}

describe('AjouterCoachUseCase', () => {
  it('defaults presenceRepas to false when not provided', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 1,
      dossierId: 5,
      nom: 'Bowman',
      prenom: 'Scotty',
      presenceRepas: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const prisma = { inscCoachDossier: { create } } as unknown as InscriptionPrismaService;
    const useCase = new AjouterCoachUseCase(prisma, makeDossierAccess({}));

    const result = await useCase.execute('user-1', {
      nom: 'Bowman',
      prenom: 'Scotty',
    });

    expect(create).toHaveBeenCalledWith({
      data: { dossierId: 5, nom: 'Bowman', prenom: 'Scotty', presenceRepas: false },
    });
    expect(result.presenceRepas).toBe(false);
  });

  it('honors an explicit presenceRepas: true', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 1,
      dossierId: 5,
      nom: 'Bowman',
      prenom: 'Scotty',
      presenceRepas: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const prisma = { inscCoachDossier: { create } } as unknown as InscriptionPrismaService;
    const useCase = new AjouterCoachUseCase(prisma, makeDossierAccess({}));

    await useCase.execute('user-1', {
      nom: 'Bowman',
      prenom: 'Scotty',
      presenceRepas: true,
    });

    expect(create).toHaveBeenCalledWith({
      data: { dossierId: 5, nom: 'Bowman', prenom: 'Scotty', presenceRepas: true },
    });
  });
});

describe('ModifierCoachUseCase', () => {
  it("throws NotFoundException when the coach belongs to another user's dossier", async () => {
    const update = jest.fn();
    const prisma = {
      inscCoachDossier: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, dossier: { inscriptionId: 999 } }),
        update,
      },
    } as unknown as InscriptionPrismaService;
    const useCase = new ModifierCoachUseCase(prisma, makeDossierAccess({}));

    await expect(useCase.execute('user-1', 1, {})).rejects.toThrow(
      NotFoundException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('updates the coach when it belongs to the caller inscription', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 1,
      dossierId: 5,
      nom: 'Bowman',
      prenom: 'Scotty',
      presenceRepas: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const prisma = {
      inscCoachDossier: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 1, dossier: { inscriptionId: INSCRIPTION_EN_COURS.id } }),
        update,
      },
    } as unknown as InscriptionPrismaService;
    const useCase = new ModifierCoachUseCase(prisma, makeDossierAccess({}));

    const result = await useCase.execute('user-1', 1, { presenceRepas: true });

    expect(update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { nom: undefined, prenom: undefined, presenceRepas: true },
    });
    expect(result.presenceRepas).toBe(true);
  });
});

describe('SupprimerCoachUseCase', () => {
  it('throws NotFoundException and does not delete when the coach does not belong to the caller', async () => {
    const del = jest.fn();
    const prisma = {
      inscCoachDossier: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, dossier: { inscriptionId: 999 } }),
        delete: del,
      },
    } as unknown as InscriptionPrismaService;
    const useCase = new SupprimerCoachUseCase(prisma, makeDossierAccess({}));

    await expect(useCase.execute('user-1', 1)).rejects.toThrow(
      NotFoundException,
    );
    expect(del).not.toHaveBeenCalled();
  });

  it('deletes the coach when it belongs to the caller inscription', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      inscCoachDossier: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 1, dossier: { inscriptionId: INSCRIPTION_EN_COURS.id } }),
        delete: del,
      },
    } as unknown as InscriptionPrismaService;
    const useCase = new SupprimerCoachUseCase(prisma, makeDossierAccess({}));

    await useCase.execute('user-1', 1);

    expect(del).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
