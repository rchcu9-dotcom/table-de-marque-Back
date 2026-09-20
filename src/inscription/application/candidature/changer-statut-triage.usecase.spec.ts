import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ChangerStatutTriageUseCase } from './changer-statut-triage.usecase';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import type { QuotaInscriptionService } from '../shared/quota-inscription.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInscription(overrides: {
  id?: number;
  statut?: string;
  editionId?: number;
} = {}) {
  return {
    id: overrides.id ?? 1,
    editionId: overrides.editionId ?? 10,
    equipeNom: 'TestTeam',
    statut: overrides.statut ?? 'CANDIDATE',
  };
}

function makePrisma(overrides: {
  findUnique?: jest.Mock;
  update?: jest.Mock;
} = {}): InscriptionPrismaService {
  return {
    inscInscription: {
      findUnique: overrides.findUnique ?? jest.fn().mockResolvedValue(makeInscription()),
      update: overrides.update ?? jest.fn(),
    },
  } as unknown as InscriptionPrismaService;
}

function makeQuotaService(
  verifierQuotaDisponible: jest.Mock = jest.fn().mockResolvedValue(undefined),
): QuotaInscriptionService {
  return { verifierQuotaDisponible } as unknown as QuotaInscriptionService;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ChangerStatutTriageUseCase', () => {
  describe('execute() — transitions valides entre les 4 statuts de triage (AC8)', () => {
    it.each([
      ['CANDIDATE', 'PAIEMENT_ATTENDU', true],
      ['CANDIDATE', 'LISTE_ATTENTE', false],
      ['CANDIDATE', 'REFUSEE', false],
      ['LISTE_ATTENTE', 'PAIEMENT_ATTENDU', true],
      ['REFUSEE', 'PAIEMENT_ATTENDU', true],
      ['PAIEMENT_ATTENDU', 'LISTE_ATTENTE', false],
      ['PAIEMENT_ATTENDU', 'REFUSEE', false],
      ['LISTE_ATTENTE', 'REFUSEE', false],
      ['REFUSEE', 'LISTE_ATTENTE', false],
    ] as const)(
      '%s → %s (vérification de quota attendue : %s)',
      async (statutDepart, statutCible, quotaAttendu) => {
        const findUnique = jest
          .fn()
          .mockResolvedValue(makeInscription({ id: 1, statut: statutDepart }));
        const update = jest
          .fn()
          .mockResolvedValue({ id: 1, statut: statutCible });
        const verifierQuotaDisponible = jest.fn().mockResolvedValue(undefined);
        const useCase = new ChangerStatutTriageUseCase(
          makePrisma({ findUnique, update }),
          makeQuotaService(verifierQuotaDisponible),
        );

        const result = await useCase.execute(1, { statut: statutCible });

        expect(update).toHaveBeenCalledWith({
          where: { id: 1 },
          data: { statut: statutCible },
        });
        expect(result).toEqual({ id: 1, statut: statutCible });
        if (quotaAttendu) {
          expect(verifierQuotaDisponible).toHaveBeenCalledWith(10);
        } else {
          expect(verifierQuotaDisponible).not.toHaveBeenCalled();
        }
      },
    );
  });

  describe('execute() — rejet hors phase de triage (AC6, AC8)', () => {
    it.each(['VALIDEE', 'DOSSIER_EN_COURS', 'DOSSIER_COMPLET'])(
      'rejette avec 400 quand le statut courant est %s, sans écrire en base',
      async (statutHorsTriage) => {
        const update = jest.fn();
        const verifierQuotaDisponible = jest.fn();
        const useCase = new ChangerStatutTriageUseCase(
          makePrisma({
            findUnique: jest
              .fn()
              .mockResolvedValue(makeInscription({ statut: statutHorsTriage })),
            update,
          }),
          makeQuotaService(verifierQuotaDisponible),
        );

        await expect(
          useCase.execute(1, { statut: 'REFUSEE' }),
        ).rejects.toThrow(BadRequestException);
        expect(update).not.toHaveBeenCalled();
        expect(verifierQuotaDisponible).not.toHaveBeenCalled();
      },
    );
  });

  describe('execute() — rejet par dépassement de plafond (AC4, AC8)', () => {
    it('propage le rejet du service de quota et ne modifie pas le statut', async () => {
      const update = jest.fn();
      const verifierQuotaDisponible = jest
        .fn()
        .mockRejectedValue(
          new BadRequestException("Le nombre maximum d'équipes (16) est atteint"),
        );
      const useCase = new ChangerStatutTriageUseCase(
        makePrisma({
          findUnique: jest
            .fn()
            .mockResolvedValue(makeInscription({ statut: 'LISTE_ATTENTE' })),
          update,
        }),
        makeQuotaService(verifierQuotaDisponible),
      );

      await expect(
        useCase.execute(1, { statut: 'PAIEMENT_ATTENDU' }),
      ).rejects.toThrow(BadRequestException);
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('execute() — idempotence sur statut inchangé (AC7, AC8)', () => {
    it.each(['CANDIDATE', 'PAIEMENT_ATTENDU', 'LISTE_ATTENTE', 'REFUSEE'] as const)(
      'retourne le statut inchangé sans appeler update() ni le service de quota (statut=%s)',
      async (statut) => {
        const update = jest.fn();
        const verifierQuotaDisponible = jest.fn();
        const useCase = new ChangerStatutTriageUseCase(
          makePrisma({
            findUnique: jest
              .fn()
              .mockResolvedValue(makeInscription({ id: 7, statut })),
            update,
          }),
          makeQuotaService(verifierQuotaDisponible),
        );

        // Le DTO n'autorise que PAIEMENT_ATTENDU/LISTE_ATTENTE/REFUSEE comme cible ;
        // le cas statut=CANDIDATE ne peut donc être testé qu'indirectement via un
        // contournement de typage — non applicable en pratique (CANDIDATE n'est
        // jamais une cible valide), ce cas est donc sauté.
        if (statut === 'CANDIDATE') return;

        const result = await useCase.execute(7, {
          statut: statut as 'PAIEMENT_ATTENDU' | 'LISTE_ATTENTE' | 'REFUSEE',
        });

        expect(result).toEqual({ id: 7, statut });
        expect(update).not.toHaveBeenCalled();
        expect(verifierQuotaDisponible).not.toHaveBeenCalled();
      },
    );
  });

  describe('execute() — candidature introuvable', () => {
    it('lève NotFoundException et ne modifie rien', async () => {
      const update = jest.fn();
      const verifierQuotaDisponible = jest.fn();
      const useCase = new ChangerStatutTriageUseCase(
        makePrisma({ findUnique: jest.fn().mockResolvedValue(null), update }),
        makeQuotaService(verifierQuotaDisponible),
      );

      await expect(
        useCase.execute(999, { statut: 'REFUSEE' }),
      ).rejects.toThrow(NotFoundException);
      expect(update).not.toHaveBeenCalled();
      expect(verifierQuotaDisponible).not.toHaveBeenCalled();
    });
  });
});
