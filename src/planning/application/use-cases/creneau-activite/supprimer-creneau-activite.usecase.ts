import { Inject, Injectable } from '@nestjs/common';
import {
  CreneauActiviteRepository,
  CRENEAU_ACTIVITE_REPOSITORY,
} from '../../../domain/repositories/creneau-activite.repository';
import { EditionVerrouService } from '@/inscription/application/shared/edition-verrou.service';

@Injectable()
export class SupprimerCreneauActiviteUseCase {
  constructor(
    @Inject(CRENEAU_ACTIVITE_REPOSITORY)
    private readonly repository: CreneauActiviteRepository,
    private readonly editionVerrou: EditionVerrouService,
  ) {}

  async execute(id: number, editionId: number): Promise<void> {
    // Formule sportive figée au lancement du tournoi (404 si l'édition n'existe pas).
    await this.editionVerrou.assertFormuleSportiveModifiable(editionId);
    return this.repository.delete(id, editionId);
  }
}
