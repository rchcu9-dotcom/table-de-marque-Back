import { GetPresentationUseCase } from '@/application/presentation/use-cases/get-presentation.usecase';
import { PresentationRepository } from '@/domain/presentation/repositories/presentation.repository';
import {
  ArticlePresentation,
  PresentationGroupe,
} from '@/domain/presentation/entities/article-presentation.entity';

class InMemoryPresentationRepository implements PresentationRepository {
  constructor(private readonly groupes: PresentationGroupe[]) {}

  async findAll(): Promise<PresentationGroupe[]> {
    return this.groupes;
  }
}

const makeArticle = (titre: string): ArticlePresentation =>
  new ArticlePresentation(
    'Presentation',
    'Presentation',
    titre,
    titre,
    'Texte',
    'Text',
    null,
    null,
    null,
    null,
  );

describe('GetPresentationUseCase', () => {
  it('delegates directly to the repository without transformation', async () => {
    const groupe = new PresentationGroupe(
      'Presentation',
      'Presentation',
      [makeArticle('Resume')],
      0,
      5000,
      null,
    );
    const repo = new InMemoryPresentationRepository([groupe]);
    const useCase = new GetPresentationUseCase(repo);

    const result = await useCase.execute();

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(groupe);
  });

  it('returns an empty array when the repository has no content', async () => {
    const repo = new InMemoryPresentationRepository([]);
    const useCase = new GetPresentationUseCase(repo);

    expect(await useCase.execute()).toEqual([]);
  });
});
