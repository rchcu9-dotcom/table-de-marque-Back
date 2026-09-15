import { SupprimerPresentationGroupeUseCase } from '@/application/presentation/use-cases/supprimer-presentation-groupe.usecase';
import { PresentationArticleRepository } from '@/domain/presentation/repositories/presentation-article.repository';

describe('SupprimerPresentationGroupeUseCase', () => {
  it('delegates to deleteGroupe with the group name', async () => {
    const deleteGroupe = jest.fn().mockResolvedValue(undefined);
    const repo = { deleteGroupe } as unknown as PresentationArticleRepository;
    const useCase = new SupprimerPresentationGroupeUseCase(repo);

    await useCase.execute('Présentation');

    expect(deleteGroupe).toHaveBeenCalledWith('Présentation');
  });
});
