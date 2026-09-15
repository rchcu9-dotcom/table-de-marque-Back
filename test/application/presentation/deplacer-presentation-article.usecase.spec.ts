import { DeplacerPresentationArticleUseCase } from '@/application/presentation/use-cases/deplacer-presentation-article.usecase';
import { PresentationArticleRepository } from '@/domain/presentation/repositories/presentation-article.repository';

describe('DeplacerPresentationArticleUseCase', () => {
  it('delegates to deplacerArticle with the article id and direction', async () => {
    const deplacerArticle = jest.fn().mockResolvedValue(undefined);
    const repo = { deplacerArticle } as unknown as PresentationArticleRepository;
    const useCase = new DeplacerPresentationArticleUseCase(repo);

    await useCase.execute(7, { direction: 'bas' });

    expect(deplacerArticle).toHaveBeenCalledWith(7, 'bas');
  });
});
