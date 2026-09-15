import { Inject, Injectable } from '@nestjs/common';
import {
  PRESENTATION_ARTICLE_REPOSITORY,
  type PresentationArticleRepository,
} from '@/domain/presentation/repositories/presentation-article.repository';
import { UpdatePresentationGroupeDto } from '../dto/update-presentation-groupe.dto';

@Injectable()
export class ModifierPresentationGroupeUseCase {
  constructor(
    @Inject(PRESENTATION_ARTICLE_REPOSITORY)
    private readonly repo: PresentationArticleRepository,
  ) {}

  execute(groupe: string, dto: UpdatePresentationGroupeDto): Promise<void> {
    return this.repo.updateGroupeMeta(groupe, {
      nom: dto.nom,
      nomEn: dto.nomEn,
      dureeMs: dto.dureeMs,
      imageUrl: dto.imageUrl,
    });
  }
}
