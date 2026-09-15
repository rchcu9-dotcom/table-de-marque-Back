import { Inject, Injectable } from '@nestjs/common';
import {
  PRESENTATION_ARTICLE_REPOSITORY,
  type PresentationArticleRepository,
} from '@/domain/presentation/repositories/presentation-article.repository';

@Injectable()
export class SupprimerPresentationGroupeUseCase {
  constructor(
    @Inject(PRESENTATION_ARTICLE_REPOSITORY)
    private readonly repo: PresentationArticleRepository,
  ) {}

  execute(groupe: string): Promise<void> {
    return this.repo.deleteGroupe(groupe);
  }
}
