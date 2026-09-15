import { ConflictException } from '@nestjs/common';
import { GenererPresetUseCase } from './generer-preset.usecase';
import { FormatPhaseFinale } from '../../../domain/enums/format-phase-finale.enum';

describe('GenererPresetUseCase', () => {
  const dto = {
    preset: FormatPhaseFinale.POULES_FINALES,
    nbPoules: 4,
    nbEquipesParPoule: 4,
    nbEquipesQualifieesParPoule: 2,
  };

  it('génère et persiste le graphe proposé quand le graphe existant n’a jamais été modifié manuellement', async () => {
    const propose = { phases: [], liens: [] };
    const grapheResultat = { editionId: 1 };
    const repo = {
      getMeta: jest.fn().mockResolvedValue({ modifieManuellement: false }),
      remplacerGrapheComplet: jest.fn().mockResolvedValue(grapheResultat),
    };
    const presetGenerator = { genererGraphe: jest.fn().mockReturnValue(propose) };
    const useCase = new GenererPresetUseCase(repo as any, presetGenerator as any);

    const result = await useCase.execute(1, dto);

    expect(presetGenerator.genererGraphe).toHaveBeenCalledWith(dto.preset, {
      nbPoules: 4,
      nbEquipesParPoule: 4,
      nbEquipesQualifieesParPoule: 2,
    });
    expect(repo.remplacerGrapheComplet).toHaveBeenCalledWith(1, propose);
    expect(result).toBe(grapheResultat);
  });

  it('génère sans meta existante (première génération pour cette édition)', async () => {
    const repo = {
      getMeta: jest.fn().mockResolvedValue(null),
      remplacerGrapheComplet: jest.fn().mockResolvedValue({}),
    };
    const presetGenerator = { genererGraphe: jest.fn().mockReturnValue({ phases: [], liens: [] }) };
    const useCase = new GenererPresetUseCase(repo as any, presetGenerator as any);

    await expect(useCase.execute(1, dto)).resolves.toBeDefined();
  });

  it('rejette la régénération (CA5) quand le graphe a été modifié manuellement et forcer n’est pas fourni', async () => {
    const repo = {
      getMeta: jest.fn().mockResolvedValue({ modifieManuellement: true }),
      remplacerGrapheComplet: jest.fn(),
    };
    const presetGenerator = { genererGraphe: jest.fn() };
    const useCase = new GenererPresetUseCase(repo as any, presetGenerator as any);

    await expect(useCase.execute(1, dto)).rejects.toThrow(ConflictException);
    expect(repo.remplacerGrapheComplet).not.toHaveBeenCalled();
    expect(presetGenerator.genererGraphe).not.toHaveBeenCalled();
  });

  it('autorise la régénération destructive quand forcer=true, même si modifié manuellement', async () => {
    const grapheResultat = { editionId: 1 };
    const repo = {
      getMeta: jest.fn().mockResolvedValue({ modifieManuellement: true }),
      remplacerGrapheComplet: jest.fn().mockResolvedValue(grapheResultat),
    };
    const presetGenerator = { genererGraphe: jest.fn().mockReturnValue({ phases: [], liens: [] }) };
    const useCase = new GenererPresetUseCase(repo as any, presetGenerator as any);

    const result = await useCase.execute(1, { ...dto, forcer: true });

    expect(repo.remplacerGrapheComplet).toHaveBeenCalled();
    expect(result).toBe(grapheResultat);
  });
});
