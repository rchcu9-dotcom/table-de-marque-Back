import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlanningMatchSlot } from '../../domain/entities/planning-match-slot.entity';
import { ResoudrePlaceholderManuelUseCase } from './resoudre-placeholder-manuel.usecase';

function makeSlot(overrides: Partial<{ id: number; editionId: number; numMatch: number; cote: 1 | 2; resolu: boolean }> = {}) {
  return new PlanningMatchSlot(
    overrides.id ?? 1,
    overrides.editionId ?? 1,
    overrides.numMatch ?? 20,
    overrides.cote ?? 1,
    'placeholder:poule-A-rang-1',
    '1er Poule A',
    null,
    'A',
    1,
    overrides.resolu ?? false,
    null,
    null,
    null,
    false,
  );
}

function makeUseCase() {
  const slotRepo = {
    createMany: jest.fn(),
    findAllByEdition: jest.fn(),
    findNonResolusParPoule: jest.fn(),
    findByNumMatchSource: jest.fn(),
    findById: jest.fn(),
    marquerResolu: jest.fn(),
  };
  const matchWriter = {
    ecrireMatchs: jest.fn(),
    resoudreSlot: jest.fn().mockResolvedValue(undefined),
    trouverEquipesMatch: jest.fn(),
    trouverEquipeIdParNom: jest.fn(),
    trouverEquipeNomParId: jest.fn(),
  };
  const useCase = new ResoudrePlaceholderManuelUseCase(slotRepo as any, matchWriter as any);
  return { useCase, slotRepo, matchWriter };
}

describe('ResoudrePlaceholderManuelUseCase', () => {
  it('lève NotFoundException si le slot est introuvable', async () => {
    const { useCase, slotRepo } = makeUseCase();
    slotRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(1, 99, 5)).rejects.toThrow(NotFoundException);
  });

  it("lève NotFoundException si le slot appartient à une autre édition", async () => {
    const { useCase, slotRepo } = makeUseCase();
    slotRepo.findById.mockResolvedValue(makeSlot({ editionId: 2 }));

    await expect(useCase.execute(1, 1, 5)).rejects.toThrow(NotFoundException);
  });

  it("lève BadRequestException si l'équipe fournie est introuvable", async () => {
    const { useCase, slotRepo, matchWriter } = makeUseCase();
    slotRepo.findById.mockResolvedValue(makeSlot());
    matchWriter.trouverEquipeNomParId.mockResolvedValue(null);

    await expect(useCase.execute(1, 1, 999)).rejects.toThrow(BadRequestException);
    expect(matchWriter.resoudreSlot).not.toHaveBeenCalled();
  });

  it("résout le slot avec l'équipe fournie et marque resoluManuellement=true", async () => {
    const { useCase, slotRepo, matchWriter } = makeUseCase();
    const slot = makeSlot({ id: 1, numMatch: 20, cote: 1 });
    slotRepo.findById.mockResolvedValue(slot);
    matchWriter.trouverEquipeNomParId.mockResolvedValue('Aigles');
    slotRepo.marquerResolu.mockResolvedValue(makeSlot({ id: 1, resolu: true }));

    await useCase.execute(1, 1, 42);

    expect(matchWriter.resoudreSlot).toHaveBeenCalledWith(20, 1, 42, 'Aigles');
    expect(slotRepo.marquerResolu).toHaveBeenCalledWith(1, 42, 'Aigles', true);
  });

  it('permet de réécrire un slot déjà résolu automatiquement (correction a posteriori, spec §6)', async () => {
    const { useCase, slotRepo, matchWriter } = makeUseCase();
    const slot = makeSlot({ id: 1, numMatch: 20, cote: 1, resolu: true });
    slotRepo.findById.mockResolvedValue(slot);
    matchWriter.trouverEquipeNomParId.mockResolvedValue('Ours');
    slotRepo.marquerResolu.mockResolvedValue(makeSlot({ id: 1, resolu: true }));

    await useCase.execute(1, 1, 7);

    expect(matchWriter.resoudreSlot).toHaveBeenCalledWith(20, 1, 7, 'Ours');
    expect(slotRepo.marquerResolu).toHaveBeenCalledWith(1, 7, 'Ours', true);
  });
});
