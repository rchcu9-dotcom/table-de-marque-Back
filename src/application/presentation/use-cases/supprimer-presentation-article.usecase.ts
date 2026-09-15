import { Inject, Injectable } from '@nestjs/common';
import {
  PRESENTATION_ARTICLE_REPOSITORY,
  type PresentationArticleRepository,
} from '@/domain/presentation/repositories/presentation-article.repository';

@Injectable()
export class SupprimerPresentationArticleUseCase {
  constructor(
    @Inject(PRESENTATION_ARTICLE_REPOSITORY)
    private readonly repo: PresentationArticleRepository,
  ) {}

  execute(id: number): Promise<void> {
    return this.repo.delete(id);
  }
}
