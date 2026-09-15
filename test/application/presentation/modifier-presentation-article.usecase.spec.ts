import { ModifierPresentationArticleUseCase } from '@/application/presentation/use-cases/modifier-presentation-article.usecase';
import {
  PresentationArticleData,
  PresentationArticleRecord,
  PresentationArticleRepository,
} from '@/domain/presentation/repositories/presentation-article.repository';
import { UpsertPresentationArticleDto } from '@/application/presentation/dto/upsert-presentation-article.dto';

const article = (
  id: number,
  groupe: string,
  groupeOrdre: number,
  groupeDureeMs: number,
  groupeImageUrl: string | null,
) =>
  new PresentationArticleRecord(
    id,
    groupe,
    groupe,
    'Titre',
    'Titre',
    'desc',
    'desc',
    null,
    null,
    null,
    null,
    0,
    groupeOrdre,
    groupeDureeMs,
    groupeImageUrl,
  );

function buildUseCase(findAllOrdered: jest.Mock, update: jest.Mock) {
  const repo = { findAllOrdered, update } as unknown as PresentationArticleRepository;
  return new ModifierPresentationArticleUseCase(repo);
}

const dto: UpsertPresentationArticleDto = {
  groupe: 'Présentation',
  groupeEn: 'Presentation',
  titre: 'Résumé modifié',
  titreEn: 'Summary edited',
  description: 'desc',
  descriptionEn: 'desc en',
  imageUrl: null,
  lienUrl: null,
  lieu: null,
  mapsQuery: null,
  ordre: 0,
};

describe('ModifierPresentationArticleUseCase', () => {
  it('excludes the edited article itself when resolving the target group meta', async () => {
    // The article being edited already belongs to "Présentation" with its own
    // (possibly stale) groupe* fields — it must not be counted as "the"
    // existing article to inherit from, otherwise editing it would always be
    // a no-op regardless of what other articles in the group have.
    const editedArticle = article(1, 'Présentation', 99, 1111, 'stale.png');
    const otherArticleSameGroup = article(2, 'Présentation', 3, 7000, 'https://x/img.png');
    const findAllOrdered = jest
      .fn()
      .mockResolvedValue([editedArticle, otherArticleSameGroup]);
    const update = jest.fn().mockResolvedValue({} as PresentationArticleRecord);
    const useCase = buildUseCase(findAllOrdered, update);

    await useCase.execute(1, dto);

    const [, data] = update.mock.calls[0] as [number, PresentationArticleData];
    expect(data.groupeOrdre).toBe(3);
    expect(data.groupeDureeMs).toBe(7000);
    expect(data.groupeImageUrl).toBe('https://x/img.png');
  });

  it('computes fresh defaults when moving the article into a brand new group', async () => {
    const editedArticle = article(1, 'Présentation', 0, 5000, null);
    const otherGroupArticle = article(2, 'Règlement', 3, 6000, null);
    const findAllOrdered = jest
      .fn()
      .mockResolvedValue([editedArticle, otherGroupArticle]);
    const update = jest.fn().mockResolvedValue({} as PresentationArticleRecord);
    const useCase = buildUseCase(findAllOrdered, update);

    await useCase.execute(1, { ...dto, groupe: 'Nouveau', groupeEn: 'New' });

    const [, data] = update.mock.calls[0] as [number, PresentationArticleData];
    // maxOrdre is computed excluding the edited article itself (id: 1) -> next after "Règlement" (3) is 4.
    expect(data.groupeOrdre).toBe(4);
    expect(data.groupeDureeMs).toBe(5000);
    expect(data.groupeImageUrl).toBeNull();
  });

  it('passes the id and forwards every DTO field to the repository', async () => {
    const findAllOrdered = jest.fn().mockResolvedValue([]);
    const update = jest.fn().mockResolvedValue({} as PresentationArticleRecord);
    const useCase = buildUseCase(findAllOrdered, update);

    await useCase.execute(42, dto);

    expect(update).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        groupe: dto.groupe,
        titre: dto.titre,
        ordre: dto.ordre,
      }),
    );
  });

  it('forwards titreAccroche/descriptionCourte (FR+EN), defaulting to empty strings when omitted', async () => {
    const findAllOrdered = jest.fn().mockResolvedValue([]);
    const update = jest.fn().mockResolvedValue({} as PresentationArticleRecord);
    const useCase = buildUseCase(findAllOrdered, update);

    await useCase.execute(42, dto);

    expect(update).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        titreAccroche: '',
        titreAccrocheEn: '',
        descriptionCourte: '',
        descriptionCourteEn: '',
      }),
    );

    await useCase.execute(42, {
      ...dto,
      titreAccroche: 'Le tournoi arrive.',
      titreAccrocheEn: 'The tournament is here.',
      descriptionCourte: 'Deux jours de glace.',
      descriptionCourteEn: 'Two days on ice.',
    });

    expect(update).toHaveBeenLastCalledWith(
      42,
      expect.objectContaining({
        titreAccroche: 'Le tournoi arrive.',
        titreAccrocheEn: 'The tournament is here.',
        descriptionCourte: 'Deux jours de glace.',
        descriptionCourteEn: 'Two days on ice.',
      }),
    );
  });
});
