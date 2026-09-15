import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AjouterJoueurUseCase } from '@/inscription/application/dossier/ajouter-joueur.usecase';
import { ModifierJoueurUseCase } from '@/inscription/application/dossier/modifier-joueur.usecase';
import { SupprimerJoueurUseCase } from '@/inscription/application/dossier/supprimer-joueur.usecase';
import type { AnneeAgeValidationService } from '@/inscription/application/dossier/annee-age-validation.service';
import type { InscriptionPrismaService } from '@/inscription/infrastructure/persistence/inscription-prisma.service';
import type { DossierAccessService } from '@/inscription/application/dossier/dossier-access.service';
import { InscriptionStatut } from '@prisma/client';

const INSCRIPTION_EN_COURS = {
  id: 100,
  editionId: 1,
  statut: InscriptionStatut.DOSSIER_EN_COURS,
};

function makeDossierAccess(overrides: {
  getInscriptionActivePourUtilisateur?: jest.Mock;
  assertDossierModifiable?: jest.Mock;
  assurerDossierEnCours?: jest.Mock;
}): DossierAccessService {
  return {
    getInscriptionActivePourUtilisateur:
      overrides.getInscriptionActivePourUtilisateur ??
      jest.fn().mockResolvedValue(INSCRIPTION_EN_COURS),
    assertDossierModifiable: overrides.assertDossierModifiable ?? jest.fn(),
    assurerDossierEnCours:
      overrides.assurerDossierEnCours ?? jest.fn().mockResolvedValue(5),
  } as unknown as DossierAccessService;
}

function makeAnneeAgeValidation(
  assertAnneeAgeValide: jest.Mock = jest.fn().mockResolvedValue(undefined),
): AnneeAgeValidationService {
  return { assertAnneeAgeValide } as unknown as AnneeAgeValidationService;
}

describe('AjouterJoueurUseCase', () => {
  const dto = {
    nom: 'Gretzky',
    prenom: 'Wayne',
    numero: 99,
    poste: 'D' as const,
    anneeNaissance: 2015,
  };

  it('propagates the BadRequestException when the dossier is not modifiable', async () => {
    const assertDossierModifiable = jest.fn(() => {
      throw new BadRequestException('verrouillé');
    });
    const prisma = { inscJoueurDossier: { create: jest.fn() } } as unknown as InscriptionPrismaService;
    const useCase = new AjouterJoueurUseCase(
      prisma,
      makeDossierAccess({ assertDossierModifiable }),
      makeAnneeAgeValidation(),
    );

    await expect(useCase.execute('user-1', dto)).rejects.toThrow('verrouillé');
    expect(prisma.inscJoueurDossier.create).not.toHaveBeenCalled();
  });

  it("propagates the BadRequestException from AnneeAgeValidationService when the year is not configured (CA4) and does not create the player", async () => {
    const create = jest.fn();
    const assertAnneeAgeValide = jest
      .fn()
      .mockRejectedValue(new BadRequestException("Année d'âge 2020 non configurée pour cette édition."));
    const prisma = { inscJoueurDossier: { create } } as unknown as InscriptionPrismaService;
    const useCase = new AjouterJoueurUseCase(
      prisma,
      makeDossierAccess({}),
      makeAnneeAgeValidation(assertAnneeAgeValide),
    );

    await expect(
      useCase.execute('user-1', { ...dto, anneeNaissance: 2020 }),
    ).rejects.toThrow("Année d'âge 2020 non configurée pour cette édition.");
    expect(create).not.toHaveBeenCalled();
  });

  it("validates the anneeNaissance against the caller's edition before creating", async () => {
    const assertAnneeAgeValide = jest.fn().mockResolvedValue(undefined);
    const create = jest.fn().mockResolvedValue({
      id: 1,
      dossierId: 5,
      nom: 'Gretzky',
      prenom: 'Wayne',
      numero: 99,
      poste: 'D',
      licenceFFH: null,
      anneeNaissance: 2015,
      particularitesAlim: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const prisma = { inscJoueurDossier: { create } } as unknown as InscriptionPrismaService;
    const useCase = new AjouterJoueurUseCase(
      prisma,
      makeDossierAccess({}),
      makeAnneeAgeValidation(assertAnneeAgeValide),
    );

    await useCase.execute('user-1', dto);

    expect(assertAnneeAgeValide).toHaveBeenCalledWith(1, 2015);
  });

  it('creates the joueur on the dossier resolved via assurerDossierEnCours, defaulting optional fields to null', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 1,
      dossierId: 5,
      nom: 'Gretzky',
      prenom: 'Wayne',
      numero: 99,
      poste: 'D',
      licenceFFH: null,
      anneeNaissance: 2015,
      particularitesAlim: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const prisma = { inscJoueurDossier: { create } } as unknown as InscriptionPrismaService;
    const useCase = new AjouterJoueurUseCase(
      prisma,
      makeDossierAccess({}),
      makeAnneeAgeValidation(),
    );

    const result = await useCase.execute('user-1', dto);

    expect(create).toHaveBeenCalledWith({
      data: {
        dossierId: 5,
        nom: 'Gretzky',
        prenom: 'Wayne',
        numero: 99,
        poste: 'D',
        licenceFFH: null,
        anneeNaissance: 2015,
        particularitesAlim: null,
      },
    });
    expect(result.nom).toBe('Gretzky');
  });
});

describe('ModifierJoueurUseCase', () => {
  it('throws NotFoundException when the joueur does not exist', async () => {
    const prisma = {
      inscJoueurDossier: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    } as unknown as InscriptionPrismaService;
    const useCase = new ModifierJoueurUseCase(
      prisma,
      makeDossierAccess({}),
      makeAnneeAgeValidation(),
    );

    await expect(useCase.execute('user-1', 1, {})).rejects.toThrow(
      NotFoundException,
    );
  });

  it("throws NotFoundException when the joueur belongs to another user's dossier", async () => {
    const prisma = {
      inscJoueurDossier: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          dossier: { inscriptionId: 999 },
        }),
        update: jest.fn(),
      },
    } as unknown as InscriptionPrismaService;
    const useCase = new ModifierJoueurUseCase(
      prisma,
      makeDossierAccess({}),
      makeAnneeAgeValidation(),
    );

    await expect(useCase.execute('user-1', 1, {})).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.inscJoueurDossier.update).not.toHaveBeenCalled();
  });

  it('updates the joueur when it belongs to the caller inscription', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 1,
      dossierId: 5,
      nom: 'Lemieux',
      prenom: 'Mario',
      numero: 66,
      poste: 'D',
      licenceFFH: null,
      anneeNaissance: null,
      particularitesAlim: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const prisma = {
      inscJoueurDossier: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          dossier: { inscriptionId: INSCRIPTION_EN_COURS.id },
        }),
        update,
      },
    } as unknown as InscriptionPrismaService;
    const useCase = new ModifierJoueurUseCase(
      prisma,
      makeDossierAccess({}),
      makeAnneeAgeValidation(),
    );

    const result = await useCase.execute('user-1', 1, { nom: 'Lemieux' });

    expect(update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        nom: 'Lemieux',
        prenom: undefined,
        numero: undefined,
        poste: undefined,
        licenceFFH: undefined,
        anneeNaissance: undefined,
        particularitesAlim: undefined,
      },
    });
    expect(result.nom).toBe('Lemieux');
  });

  it('does not call AnneeAgeValidationService when anneeNaissance is not part of the partial update', async () => {
    const assertAnneeAgeValide = jest.fn();
    const update = jest.fn().mockResolvedValue({
      id: 1,
      dossierId: 5,
      nom: 'Lemieux',
      prenom: 'Mario',
      numero: 66,
      poste: 'D',
      licenceFFH: null,
      anneeNaissance: null,
      particularitesAlim: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const prisma = {
      inscJoueurDossier: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          dossier: { inscriptionId: INSCRIPTION_EN_COURS.id },
        }),
        update,
      },
    } as unknown as InscriptionPrismaService;
    const useCase = new ModifierJoueurUseCase(
      prisma,
      makeDossierAccess({}),
      makeAnneeAgeValidation(assertAnneeAgeValide),
    );

    await useCase.execute('user-1', 1, { nom: 'Lemieux' });

    expect(assertAnneeAgeValide).not.toHaveBeenCalled();
  });

  it("validates anneeNaissance against the caller's edition when provided in the partial update, and propagates rejection", async () => {
    const assertAnneeAgeValide = jest
      .fn()
      .mockRejectedValue(new BadRequestException("Année d'âge 2020 non configurée pour cette édition."));
    const update = jest.fn();
    const prisma = {
      inscJoueurDossier: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          dossier: { inscriptionId: INSCRIPTION_EN_COURS.id },
        }),
        update,
      },
    } as unknown as InscriptionPrismaService;
    const useCase = new ModifierJoueurUseCase(
      prisma,
      makeDossierAccess({}),
      makeAnneeAgeValidation(assertAnneeAgeValide),
    );

    await expect(
      useCase.execute('user-1', 1, { anneeNaissance: 2020 }),
    ).rejects.toThrow("Année d'âge 2020 non configurée pour cette édition.");
    expect(assertAnneeAgeValide).toHaveBeenCalledWith(1, 2020);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('SupprimerJoueurUseCase', () => {
  it('throws NotFoundException and does not delete when the joueur does not belong to the caller', async () => {
    const del = jest.fn();
    const prisma = {
      inscJoueurDossier: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          dossier: { inscriptionId: 999 },
        }),
        delete: del,
      },
    } as unknown as InscriptionPrismaService;
    const useCase = new SupprimerJoueurUseCase(prisma, makeDossierAccess({}));

    await expect(useCase.execute('user-1', 1)).rejects.toThrow(
      NotFoundException,
    );
    expect(del).not.toHaveBeenCalled();
  });

  it('deletes the joueur when it belongs to the caller inscription', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      inscJoueurDossier: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          dossier: { inscriptionId: INSCRIPTION_EN_COURS.id },
        }),
        delete: del,
      },
    } as unknown as InscriptionPrismaService;
    const useCase = new SupprimerJoueurUseCase(prisma, makeDossierAccess({}));

    await useCase.execute('user-1', 1);

    expect(del).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
