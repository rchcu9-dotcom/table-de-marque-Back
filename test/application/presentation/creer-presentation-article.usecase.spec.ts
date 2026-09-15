import { CreerPresentationArticleUseCase } from '@/application/presentation/use-cases/creer-presentation-article.usecase';
import {
  PresentationArticleData,
  PresentationArticleRecord,
  PresentationArticleRepository,
} from '@/domain/presentation/repositories/presentation-article.repository';
import { UpsertPresentationArticleDto } from '@/application/presentation/dto/upsert-presentation-article.dto';

const existingArticle = (
  groupe: string,
  groupeOrdre: number,
  groupeDureeMs: number,
  groupeImageUrl: string | null,
) =>
  new PresentationArticleRecord(
    1,
    groupe,
    groupe,
    'Titre existant',
    'Titre existant',
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

function buildUseCase(findAllOrdered: jest.Mock, create: jest.Mock) {
  const repo = { findAllOrdered, create } as unknown as PresentationArticleRepository;
  return new CreerPresentationArticleUseCase(repo);
}

const dto: UpsertPresentationArticleDto = {
  groupe: 'Présentation',
  groupeEn: 'Presentation',
  titre: 'Résumé',
  titreEn: 'Summary',
  description: 'desc',
  descriptionEn: 'desc en',
  imageUrl: null,
  lienUrl: null,
  lieu: null,
  mapsQuery: null,
  ordre: 3,
};

describe('CreerPresentationArticleUseCase', () => {
  it('inherits groupeOrdre/groupeDureeMs/groupeImageUrl from an existing group rather than resetting them', async () => {
    const findAllOrdered = jest
      .fn()
      .mockResolvedValue([existingArticle('Présentation', 1, 9000, 'https://x/img.png')]);
    const create = jest.fn().mockResolvedValue({} as PresentationArticleRecord);
    const useCase = buildUseCase(findAllOrdered, create);

    await useCase.execute(dto);

    const [data] = create.mock.calls[0] as [PresentationArticleData];
    expect(data.groupeOrdre).toBe(1);
    expect(data.groupeDureeMs).toBe(9000);
    expect(data.groupeImageUrl).toBe('https://x/img.png');
  });

  it('computes fresh defaults (next groupeOrdre, 5000ms, no image) when the group is brand new', async () => {
    const findAllOrdered = jest
      .fn()
      .mockResolvedValue([existingArticle('Règlement', 0, 5000, null)]);
    const create = jest.fn().mockResolvedValue({} as PresentationArticleRecord);
    const useCase = buildUseCase(findAllOrdered, create);

    await useCase.execute({ ...dto, groupe: 'Médias', groupeEn: 'Media' });

    const [data] = create.mock.calls[0] as [PresentationArticleData];
    expect(data.groupeOrdre).toBe(1);
    expect(data.groupeDureeMs).toBe(5000);
    expect(data.groupeImageUrl).toBeNull();
  });

  it('forwards every article field from the DTO, nullifying optional fields left undefined', async () => {
    const findAllOrdered = jest.fn().mockResolvedValue([]);
    const create = jest.fn().mockResolvedValue({} as PresentationArticleRecord);
    const useCase = buildUseCase(findAllOrdered, create);

    await useCase.execute(dto);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        groupe: dto.groupe,
        groupeEn: dto.groupeEn,
        titre: dto.titre,
        titreEn: dto.titreEn,
        description: dto.description,
        descriptionEn: dto.descriptionEn,
        imageUrl: null,
        lienUrl: null,
        lieu: null,
        mapsQuery: null,
        ordre: dto.ordre,
      }),
    );
  });

  it('forwards titreAccroche/descriptionCourte (FR+EN) from the DTO, defaulting to empty strings when omitted', async () => {
    const findAllOrdered = jest.fn().mockResolvedValue([]);
    const create = jest.fn().mockResolvedValue({} as PresentationArticleRecord);
    const useCase = buildUseCase(findAllOrdered, create);

    await useCase.execute(dto);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        titreAccroche: '',
        titreAccrocheEn: '',
        descriptionCourte: '',
        descriptionCourteEn: '',
      }),
    );

    await useCase.execute({
      ...dto,
      titreAccroche: 'Le tournoi arrive.',
      titreAccrocheEn: 'The tournament is here.',
      descriptionCourte: 'Deux jours de glace.',
      descriptionCourteEn: 'Two days on ice.',
    });

    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        titreAccroche: 'Le tournoi arrive.',
        titreAccrocheEn: 'The tournament is here.',
        descriptionCourte: 'Deux jours de glace.',
        descriptionCourteEn: 'Two days on ice.',
      }),
    );
  });
});
