import { DeplacerPresentationGroupeUseCase } from '@/application/presentation/use-cases/deplacer-presentation-groupe.usecase';
import { PresentationArticleRepository } from '@/domain/presentation/repositories/presentation-article.repository';

describe('DeplacerPresentationGroupeUseCase', () => {
  it('delegates to deplacerGroupe with the group name and direction', async () => {
    const deplacerGroupe = jest.fn().mockResolvedValue(undefined);
    const repo = { deplacerGroupe } as unknown as PresentationArticleRepository;
    const useCase = new DeplacerPresentationGroupeUseCase(repo);

    await useCase.execute('Présentation', { direction: 'haut' });

    expect(deplacerGroupe).toHaveBeenCalledWith('Présentation', 'haut');
  });

  it('forwards the "bas" direction as-is', async () => {
    const deplacerGroupe = jest.fn().mockResolvedValue(undefined);
    const repo = { deplacerGroupe } as unknown as PresentationArticleRepository;
    const useCase = new DeplacerPresentationGroupeUseCase(repo);

    await useCase.execute('Présentation', { direction: 'bas' });

    expect(deplacerGroupe).toHaveBeenCalledWith('Présentation', 'bas');
  });
});
