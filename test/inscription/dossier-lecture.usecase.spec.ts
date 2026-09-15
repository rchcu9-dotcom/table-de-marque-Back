import { NotFoundException } from '@nestjs/common';
import { GetMonDossierUseCase } from '@/inscription/application/dossier/get-mon-dossier.usecase';
import { GetDossierParInscriptionUseCase } from '@/inscription/application/dossier/get-dossier-par-inscription.usecase';
import { AccepterDroitsImageUseCase } from '@/inscription/application/dossier/accepter-droits-image.usecase';
import type { InscriptionPrismaService } from '@/inscription/infrastructure/persistence/inscription-prisma.service';
import type { DossierAccessService } from '@/inscription/application/dossier/dossier-access.service';
import { InscriptionStatut } from '@prisma/client';

const INSCRIPTION_EN_COURS = { id: 100, statut: InscriptionStatut.DOSSIER_EN_COURS };

function makeDossierAccess(overrides: {
  getInscriptionActivePourUtilisateur?: jest.Mock;
  assurerDossierEnCours?: jest.Mock;
}): DossierAccessService {
  return {
    getInscriptionActivePourUtilisateur:
      overrides.getInscriptionActivePourUtilisateur ??
      jest.fn().mockResolvedValue(INSCRIPTION_EN_COURS),
    assertDossierModifiable: jest.fn(),
    assurerDossierEnCours:
      overrides.assurerDossierEnCours ?? jest.fn().mockResolvedValue(5),
  } as unknown as DossierAccessService;
}

describe('GetMonDossierUseCase', () => {
  it('returns an empty dossier shell when no InscDossier row exists yet', async () => {
    const prisma = {
      inscDossier: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as InscriptionPrismaService;
    const useCase = new GetMonDossierUseCase(prisma, makeDossierAccess({}));

    const result = await useCase.execute('user-1');

    expect(result).toEqual({
      dossier: null,
      joueurs: [],
      coachs: [],
      statutInscription: InscriptionStatut.DOSSIER_EN_COURS,
    });
  });

  it('maps the dossier, joueurs and coachs when the dossier exists', async () => {
    const now = new Date('2026-01-01');
    const prisma = {
      inscDossier: {
        findUnique: jest.fn().mockResolvedValue({
          id: 5,
          inscriptionId: 100,
          dateVirementInscription: null,
          dateReceptionInscription: null,
          datePaiementRepas: null,
          dateReceptionRepas: null,
          repasPaiementRecu: false,
          droitsImageAcceptes: true,
          droitsImageHorodatage: now,
          createdAt: now,
          updatedAt: now,
          joueurs: [
            {
              id: 1,
              dossierId: 5,
              nom: 'Gretzky',
              prenom: 'Wayne',
              numero: 99,
              poste: 'A',
              licenceFFH: null,
              anneeNaissance: null,
              particularitesAlim: null,
              createdAt: now,
              updatedAt: now,
            },
          ],
          coachs: [
            {
              id: 1,
              dossierId: 5,
              nom: 'Bowman',
              prenom: 'Scotty',
              presenceRepas: false,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }),
      },
    } as unknown as InscriptionPrismaService;
    const useCase = new GetMonDossierUseCase(prisma, makeDossierAccess({}));

    const result = await useCase.execute('user-1');

    expect(result.dossier?.droitsImageAcceptes).toBe(true);
    expect(result.joueurs).toHaveLength(1);
    expect(result.joueurs[0].nom).toBe('Gretzky');
    expect(result.coachs).toHaveLength(1);
    expect(result.coachs[0].nom).toBe('Bowman');
    expect(result.statutInscription).toBe(InscriptionStatut.DOSSIER_EN_COURS);
  });
});

describe('GetDossierParInscriptionUseCase', () => {
  it('throws NotFoundException when the candidature does not exist', async () => {
    const prisma = {
      inscInscription: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as InscriptionPrismaService;
    const useCase = new GetDossierParInscriptionUseCase(prisma);

    await expect(useCase.execute(1)).rejects.toThrow(NotFoundException);
  });

  it('returns an empty dossier shell when no InscDossier row exists yet', async () => {
    const prisma = {
      inscInscription: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 1, statut: InscriptionStatut.VALIDEE }),
      },
      inscDossier: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as InscriptionPrismaService;
    const useCase = new GetDossierParInscriptionUseCase(prisma);

    const result = await useCase.execute(1);

    expect(result).toEqual({
      dossier: null,
      joueurs: [],
      coachs: [],
      statutInscription: InscriptionStatut.VALIDEE,
    });
  });
});

describe('AccepterDroitsImageUseCase', () => {
  it('sets droitsImageAcceptes and stamps droitsImageHorodatage when accepting', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 5,
      inscriptionId: 100,
      dateVirementInscription: null,
      dateReceptionInscription: null,
      datePaiementRepas: null,
      dateReceptionRepas: null,
      repasPaiementRecu: false,
      droitsImageAcceptes: true,
      droitsImageHorodatage: new Date('2026-01-01'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const prisma = { inscDossier: { update } } as unknown as InscriptionPrismaService;
    const useCase = new AccepterDroitsImageUseCase(prisma, makeDossierAccess({}));

    const result = await useCase.execute('user-1', { accepte: true });

    expect(update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: {
        droitsImageAcceptes: true,
        droitsImageHorodatage: expect.any(Date),
      },
    });
    expect(result.droitsImageAcceptes).toBe(true);
  });

  it('clears droitsImageHorodatage when revoking acceptance', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 5,
      inscriptionId: 100,
      dateVirementInscription: null,
      dateReceptionInscription: null,
      datePaiementRepas: null,
      dateReceptionRepas: null,
      repasPaiementRecu: false,
      droitsImageAcceptes: false,
      droitsImageHorodatage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const prisma = { inscDossier: { update } } as unknown as InscriptionPrismaService;
    const useCase = new AccepterDroitsImageUseCase(prisma, makeDossierAccess({}));

    await useCase.execute('user-1', { accepte: false });

    expect(update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { droitsImageAcceptes: false, droitsImageHorodatage: null },
    });
  });
});
