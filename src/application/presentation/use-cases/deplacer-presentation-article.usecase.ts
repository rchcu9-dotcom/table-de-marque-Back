import { Inject, Injectable } from '@nestjs/common';
import {
  PRESENTATION_ARTICLE_REPOSITORY,
  type PresentationArticleRepository,
} from '@/domain/presentation/repositories/presentation-article.repository';
import { DeplacerDirectionDto } from '../dto/deplacer-direction.dto';

@Injectable()
export class DeplacerPresentationArticleUseCase {
  constructor(
    @Inject(PRESENTATION_ARTICLE_REPOSITORY)
    private readonly repo: PresentationArticleRepository,
  ) {}

  execute(id: number, dto: DeplacerDirectionDto): Promise<void> {
    return this.repo.deplacerArticle(id, dto.direction);
  }
}
