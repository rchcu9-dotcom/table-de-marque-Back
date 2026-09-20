import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MarquerPaiementRepasUseCase } from './marquer-paiement-repas.usecase';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInscription(overrides: { id?: number; equipeNom?: string } = {}) {
  return {
    id: overrides.id ?? 1,
    equipeNom: overrides.equipeNom ?? 'TestTeam',
    statut: 'VALIDEE',
  };
}

function makePrisma(overrides: {
  findUnique?: jest.Mock;
  upsert?: jest.Mock;
} = {}) {
  return {
    inscInscription: {
      findUnique: overrides.findUnique ?? jest.fn().mockResolvedValue(makeInscription()),
    },
    inscDossier: {
      upsert: overrides.upsert ?? jest.fn(),
    },
  } as unknown as InscriptionPrismaService;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MarquerPaiementRepasUseCase', () => {
  describe('execute()', () => {
    it('crée le dossier si absent quand paye=true, avec date, mode et horodatage de réception renseignés', async () => {
      const upsert = jest.fn().mockImplementation(({ create }) =>
        Promise.resolve({ id: 99, ...create }),
      );
      const useCase = new MarquerPaiementRepasUseCase(
        makePrisma({
          findUnique: jest.fn().mockResolvedValue(makeInscription({ id: 5, equipeNom: 'Rennes' })),
          upsert,
        }),
      );

      const result = await useCase.execute(5, {
        paye: true,
        datePaiement: '2026-09-10',
        mode: 'VIREMENT',
      });

      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { inscriptionId: 5 },
          create: expect.objectContaining({
            inscriptionId: 5,
            repasPaiementRecu: true,
            dateReceptionRepas: expect.any(Date),
            datePaiementRepas: new Date('2026-09-10'),
            repasModePaiement: 'VIREMENT',
          }),
        }),
      );
      expect(result).toEqual({
        id: 5,
        equipeNom: 'Rennes',
        repasPaiementRecu: true,
        dateReceptionRepas: expect.any(Date),
        datePaiementRepas: new Date('2026-09-10'),
        repasModePaiement: 'VIREMENT',
      });
    });

    it.each(['VIREMENT', 'CHEQUE', 'AUTRE'] as const)(
      'enregistre le mode %s',
      async (mode) => {
        const upsert = jest.fn().mockImplementation(({ update }) => Promise.resolve(update));
        const useCase = new MarquerPaiementRepasUseCase(makePrisma({ upsert }));

        await useCase.execute(1, { paye: true, datePaiement: '2026-09-10', mode });

        expect(upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            update: expect.objectContaining({ repasModePaiement: mode }),
          }),
        );
      },
    );

    it("remet paiement, date et mode à zéro quand paye=false (correction d'une erreur)", async () => {
      const upsert = jest.fn().mockImplementation(({ update }) => Promise.resolve(update));
      const useCase = new MarquerPaiementRepasUseCase(
        makePrisma({ findUnique: jest.fn().mockResolvedValue(makeInscription({ id: 7 })), upsert }),
      );

      const result = await useCase.execute(7, { paye: false });

      expect(upsert).toHaveBeenLastCalledWith(
        expect.objectContaining({
          update: {
            repasPaiementRecu: false,
            dateReceptionRepas: null,
            datePaiementRepas: null,
            repasModePaiement: null,
          },
        }),
      );
      expect(result.repasPaiementRecu).toBe(false);
      expect(result.datePaiementRepas).toBeNull();
      expect(result.repasModePaiement).toBeNull();
    });

    it.each([
      ['la date', { paye: true, mode: 'CHEQUE' as const }],
      ['le mode', { paye: true, datePaiement: '2026-09-10' }],
    ])('refuse paye=true sans %s', async (_label, dto) => {
      const upsert = jest.fn();
      const useCase = new MarquerPaiementRepasUseCase(makePrisma({ upsert }));

      await expect(useCase.execute(1, dto)).rejects.toThrow(BadRequestException);
      expect(upsert).not.toHaveBeenCalled();
    });

    it("lève NotFoundException si la candidature n'existe pas", async () => {
      const useCase = new MarquerPaiementRepasUseCase(
        makePrisma({ findUnique: jest.fn().mockResolvedValue(null) }),
      );

      await expect(useCase.execute(999, { paye: false })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
