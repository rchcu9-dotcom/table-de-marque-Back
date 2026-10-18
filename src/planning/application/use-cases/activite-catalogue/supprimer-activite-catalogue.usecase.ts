import { Inject, Injectable } from '@nestjs/common';
import {
  ActiviteCatalogueRepository,
  ACTIVITE_CATALOGUE_REPOSITORY,
} from '../../../domain/repositories/activite-catalogue.repository';
import { EditionVerrouService } from '@/inscription/application/shared/edition-verrou.service';

@Injectable()
export class SupprimerActiviteCatalogueUseCase {
  constructor(
    @Inject(ACTIVITE_CATALOGUE_REPOSITORY)
    private readonly repository: ActiviteCatalogueRepository,
    private readonly editionVerrou: EditionVerrouService,
  ) {}

  async execute(id: number, editionId: number): Promise<void> {
    // Formule sportive figée au lancement du tournoi (404 si l'édition n'existe pas).
    await this.editionVerrou.assertFormuleSportiveModifiable(editionId);
    return this.repository.delete(id, editionId);
  }
}
