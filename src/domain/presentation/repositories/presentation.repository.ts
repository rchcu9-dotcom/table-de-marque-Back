import { PresentationGroupe } from '../entities/article-presentation.entity';

export const PRESENTATION_REPOSITORY = 'PRESENTATION_REPOSITORY';

export interface PresentationRepository {
  findAll(): Promise<PresentationGroupe[]>;
}
