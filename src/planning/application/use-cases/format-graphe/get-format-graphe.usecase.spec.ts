import { GetFormatGrapheUseCase } from './get-format-graphe.usecase';
import { FormatGraphe } from '../../../domain/entities/format/format-graphe.entity';
import { ParametresSportifs } from '../../../domain/entities/parametres-sportifs.entity';
import { FormatPhaseFinale } from '../../../domain/enums/format-phase-finale.enum';

function makeParametres(
  overrides: Partial<ParametresSportifs> = {},
): ParametresSportifs {
  return new ParametresSportifs(
    overrides.editionId ?? 1,
    overrides.dureeSurfacageMin ?? 20,
    overrides.dureeMatchPouleMin ?? 27,
    overrides.dureeMatchFinalMin ?? 33,
    overrides.dureeInterMatchMin ?? null,
    overrides.delaiMinActivite ?? null,
    overrides.nbPatinoires ?? null,
    overrides.nbPoules ?? null,
    overrides.nbEquipesParPoule ?? null,
    overrides.nbEquipesQualifieesParPoule ?? null,
    overrides.formatPhaseFinale ?? null,
    overrides.reglesTieBreak ?? null,
    overrides.nbPlacesMax ?? 16,
  );
}

function makeGraphe(overrides: Partial<FormatGraphe> = {}): FormatGraphe {
  return new FormatGraphe(
    overrides.editionId ?? 1,
    overrides.phases ?? [],
    overrides.groupes ?? [],
    overrides.liens ?? [],
    overrides.modifieManuellement ?? false,
    overrides.genereDepuisPreset ?? null,
  );
}

describe('GetFormatGrapheUseCase', () => {
  it('retourne le graphe persisté tel quel quand des Phases existent déjà', async () => {
    const graphePersiste = makeGraphe({
      phases: [{ id: 1, editionId: 1, nom: 'Brassage', ordre: 1, joursIds: [] } as any],
    });
    const repo = {
      getGraphe: jest.fn().mockResolvedValue(graphePersiste),
      remplacerGrapheComplet: jest.fn(),
    };
    const getParametresSportifs = { execute: jest.fn() };
    const presetGenerator = { genererGraphe: jest.fn() };
    const useCase = new GetFormatGrapheUseCase(
      repo as any,
      getParametresSportifs as any,
      presetGenerator as any,
    );

    const result = await useCase.execute(1);

    expect(result).toBe(graphePersiste);
    expect(getParametresSportifs.execute).not.toHaveBeenCalled();
    expect(repo.remplacerGrapheComplet).not.toHaveBeenCalled();
  });

  it('déclenche la migration lazy (génère depuis le preset existant) quand aucune Phase n’existe', async () => {
    const grapheVide = makeGraphe({ phases: [] });
    const grapheGenere = makeGraphe({
      phases: [{ id: 1, editionId: 1, nom: 'Brassage', ordre: 1, joursIds: [] } as any],
      genereDepuisPreset: FormatPhaseFinale.POULES_FINALES,
    });
    const repo = {
      getGraphe: jest.fn().mockResolvedValue(grapheVide),
      remplacerGrapheComplet: jest.fn().mockResolvedValue(grapheGenere),
    };
    const getParametresSportifs = {
      execute: jest.fn().mockResolvedValue(
        makeParametres({
          formatPhaseFinale: FormatPhaseFinale.POULES_FINALES,
          nbPoules: 4,
          nbEquipesParPoule: 4,
          nbEquipesQualifieesParPoule: 2,
          nbPlacesMax: 16,
        }),
      ),
    };
    const propose = { phases: [], liens: [] };
    const presetGenerator = { genererGraphe: jest.fn().mockReturnValue(propose) };
    const useCase = new GetFormatGrapheUseCase(
      repo as any,
      getParametresSportifs as any,
      presetGenerator as any,
    );

    const result = await useCase.execute(1);

    expect(presetGenerator.genererGraphe).toHaveBeenCalledWith(
      FormatPhaseFinale.POULES_FINALES,
      { nbPoules: 4, nbEquipesParPoule: 4, nbEquipesQualifieesParPoule: 2 },
    );
    expect(repo.remplacerGrapheComplet).toHaveBeenCalledWith(1, propose);
    expect(result).toBe(grapheGenere);
  });

  it("utilise les valeurs par défaut quand les paramètres plats de l'édition sont tous absents", async () => {
    const repo = {
      getGraphe: jest.fn().mockResolvedValue(makeGraphe({ phases: [] })),
      remplacerGrapheComplet: jest.fn().mockResolvedValue(makeGraphe()),
    };
    const getParametresSportifs = {
      execute: jest.fn().mockResolvedValue(
        makeParametres({
          formatPhaseFinale: null,
          nbPoules: null,
          nbEquipesParPoule: null,
          nbEquipesQualifieesParPoule: null,
          nbPlacesMax: 16,
        }),
      ),
    };
    const presetGenerator = {
      genererGraphe: jest.fn().mockReturnValue({ phases: [], liens: [] }),
    };
    const useCase = new GetFormatGrapheUseCase(
      repo as any,
      getParametresSportifs as any,
      presetGenerator as any,
    );

    await useCase.execute(1);

    expect(presetGenerator.genererGraphe).toHaveBeenCalledWith(
      FormatPhaseFinale.ELIMINATION_DIRECTE,
      { nbPoules: 4, nbEquipesParPoule: 4, nbEquipesQualifieesParPoule: 2 },
    );
  });
});
