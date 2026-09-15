import { ModifierPresentationGroupeUseCase } from '@/application/presentation/use-cases/modifier-presentation-groupe.usecase';
import { PresentationArticleRepository } from '@/domain/presentation/repositories/presentation-article.repository';
import { UpdatePresentationGroupeDto } from '@/application/presentation/dto/update-presentation-groupe.dto';

describe('ModifierPresentationGroupeUseCase', () => {
  it('delegates to updateGroupeMeta with the DTO fields', async () => {
    const updateGroupeMeta = jest.fn().mockResolvedValue(undefined);
    const repo = { updateGroupeMeta } as unknown as PresentationArticleRepository;
    const useCase = new ModifierPresentationGroupeUseCase(repo);
    const dto: UpdatePresentationGroupeDto = {
      nom: 'Présentation modifiée',
      nomEn: 'Presentation edited',
      dureeMs: 7000,
      imageUrl: 'https://x/img.png',
    };

    await useCase.execute('Présentation', dto);

    expect(updateGroupeMeta).toHaveBeenCalledWith('Présentation', {
      nom: dto.nom,
      nomEn: dto.nomEn,
      dureeMs: dto.dureeMs,
      imageUrl: dto.imageUrl,
    });
  });

  it('forwards undefined fields unchanged so the repository can apply a partial update', async () => {
    const updateGroupeMeta = jest.fn().mockResolvedValue(undefined);
    const repo = { updateGroupeMeta } as unknown as PresentationArticleRepository;
    const useCase = new ModifierPresentationGroupeUseCase(repo);

    await useCase.execute('Présentation', { dureeMs: 9000 });

    expect(updateGroupeMeta).toHaveBeenCalledWith('Présentation', {
      nom: undefined,
      nomEn: undefined,
      dureeMs: 9000,
      imageUrl: undefined,
    });
  });
});
