import { Inject, Injectable } from '@nestjs/common';
import {
  PRESENTATION_ARTICLE_REPOSITORY,
  PresentationArticleRecord,
  type PresentationArticleRepository,
} from '@/domain/presentation/repositories/presentation-article.repository';

@Injectable()
export class ListPresentationArticlesUseCase {
  constructor(
    @Inject(PRESENTATION_ARTICLE_REPOSITORY)
    private readonly repo: PresentationArticleRepository,
  ) {}

  execute(): Promise<PresentationArticleRecord[]> {
    return this.repo.findAllOrdered();
  }
}
