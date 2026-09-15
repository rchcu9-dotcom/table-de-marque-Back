import { Inject, Injectable } from '@nestjs/common';
import {
  PRESENTATION_REPOSITORY,
  type PresentationRepository,
} from '@/domain/presentation/repositories/presentation.repository';
import { PresentationGroupe } from '@/domain/presentation/entities/article-presentation.entity';

@Injectable()
export class GetPresentationUseCase {
  constructor(
    @Inject(PRESENTATION_REPOSITORY)
    private readonly repo: PresentationRepository,
  ) {}

  execute(): Promise<PresentationGroupe[]> {
    return this.repo.findAll();
  }
}
