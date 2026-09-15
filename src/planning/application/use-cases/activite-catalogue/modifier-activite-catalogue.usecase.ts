import { Inject, Injectable } from '@nestjs/common';
import {
  ActiviteCatalogueRepository,
  ACTIVITE_CATALOGUE_REPOSITORY,
} from '../../../domain/repositories/activite-catalogue.repository';
import { ActiviteCatalogue } from '../../../domain/entities/activite-catalogue.entity';
import { UpsertActiviteCatalogueDto } from '../../dto/upsert-activite-catalogue.dto';

@Injectable()
export class ModifierActiviteCatalogueUseCase {
  constructor(
    @Inject(ACTIVITE_CATALOGUE_REPOSITORY)
    private readonly repository: ActiviteCatalogueRepository,
  ) {}

  execute(
    id: number,
    editionId: number,
    dto: UpsertActiviteCatalogueDto,
  ): Promise<ActiviteCatalogue> {
    return this.repository.update(id, editionId, {
      label: dto.label,
      dureeParEquipeMin: dto.dureeParEquipeMin,
      capaciteParallele: dto.capaciteParallele,
    });
  }
}
