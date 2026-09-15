import { Inject, Injectable } from '@nestjs/common';
import {
  ActiviteCatalogueRepository,
  ACTIVITE_CATALOGUE_REPOSITORY,
} from '../../../domain/repositories/activite-catalogue.repository';

@Injectable()
export class SupprimerActiviteCatalogueUseCase {
  constructor(
    @Inject(ACTIVITE_CATALOGUE_REPOSITORY)
    private readonly repository: ActiviteCatalogueRepository,
  ) {}

  execute(id: number, editionId: number): Promise<void> {
    return this.repository.delete(id, editionId);
  }
}
