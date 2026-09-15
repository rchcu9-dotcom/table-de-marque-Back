import { PresentationRepository } from '@/domain/presentation/repositories/presentation.repository';
import { PresentationGroupe } from '@/domain/presentation/entities/article-presentation.entity';

export class InMemoryPresentationRepository implements PresentationRepository {
  async findAll(): Promise<PresentationGroupe[]> {
    return [];
  }
}
