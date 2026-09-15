import { Inject, Injectable } from '@nestjs/common';
import {
  ActiviteCatalogueRepository,
  ACTIVITE_CATALOGUE_REPOSITORY,
} from '../../../domain/repositories/activite-catalogue.repository';
import { ActiviteCatalogue } from '../../../domain/entities/activite-catalogue.entity';
import { UpsertActiviteCatalogueDto } from '../../dto/upsert-activite-catalogue.dto';

@Injectable()
export class CreerActiviteCatalogueUseCase {
  constructor(
    @Inject(ACTIVITE_CATALOGUE_REPOSITORY)
    private readonly repository: ActiviteCatalogueRepository,
  ) {}

  execute(
    editionId: number,
    dto: UpsertActiviteCatalogueDto,
  ): Promise<ActiviteCatalogue> {
    return this.repository.create(editionId, {
      label: dto.label,
      dureeParEquipeMin: dto.dureeParEquipeMin,
      capaciteParallele: dto.capaciteParallele,
    });
  }
}
