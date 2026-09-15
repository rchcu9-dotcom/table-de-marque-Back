import { AjouterPlaceAliasUseCase } from './ajouter-place-alias.usecase';

describe('AjouterPlaceAliasUseCase', () => {
  it('délègue au repository et marque le graphe modifié manuellement', async () => {
    const place = { id: 1, groupeId: 10, position: 3, origine: 'ALIAS', aliasLabel: 'Équipe C', lienEntrantId: null };
    const repo = {
      ajouterPlaceAlias: jest.fn().mockResolvedValue(place),
      marquerModifieManuellement: jest.fn(),
    };
    const useCase = new AjouterPlaceAliasUseCase(repo as any);

    const result = await useCase.execute(1, 10, { aliasLabel: 'Équipe C' });

    expect(repo.ajouterPlaceAlias).toHaveBeenCalledWith(10, 'Équipe C');
    expect(repo.marquerModifieManuellement).toHaveBeenCalledWith(1);
    expect(result).toBe(place);
  });
});
