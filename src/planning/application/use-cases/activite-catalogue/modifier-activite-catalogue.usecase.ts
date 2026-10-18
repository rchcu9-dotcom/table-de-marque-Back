import { Inject, Injectable } from '@nestjs/common';
import {
  ActiviteCatalogueRepository,
  ACTIVITE_CATALOGUE_REPOSITORY,
} from '../../../domain/repositories/activite-catalogue.repository';
import { ActiviteCatalogue } from '../../../domain/entities/activite-catalogue.entity';
import { UpsertActiviteCatalogueDto } from '../../dto/upsert-activite-catalogue.dto';
import { EditionVerrouService } from '@/inscription/application/shared/edition-verrou.service';

@Injectable()
export class ModifierActiviteCatalogueUseCase {
  constructor(
    @Inject(ACTIVITE_CATALOGUE_REPOSITORY)
    private readonly repository: ActiviteCatalogueRepository,
    private readonly editionVerrou: EditionVerrouService,
  ) {}

  async execute(
    id: number,
    editionId: number,
    dto: UpsertActiviteCatalogueDto,
  ): Promise<ActiviteCatalogue> {
    // Formule sportive figée au lancement du tournoi (404 si l'édition n'existe pas).
    await this.editionVerrou.assertFormuleSportiveModifiable(editionId);
    return this.repository.update(id, editionId, {
      label: dto.label,
      dureeParEquipeMin: dto.dureeParEquipeMin,
      capaciteParallele: dto.capaciteParallele,
    });
  }
}
