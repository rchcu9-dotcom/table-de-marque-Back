import { Inject, Injectable } from '@nestjs/common';
import {
  InscriptionEditionJourRepository,
  INSCRIPTION_EDITION_JOUR_REPOSITORY,
} from '../../domain/repositories/inscription-edition-jour.repository';
import { EditionVerrouService } from '@/inscription/application/shared/edition-verrou.service';

@Injectable()
export class DeleteJourUseCase {
  constructor(
    @Inject(INSCRIPTION_EDITION_JOUR_REPOSITORY)
    private readonly repository: InscriptionEditionJourRepository,
    private readonly editionVerrou: EditionVerrouService,
  ) {}

  async execute(editionId: number, numeroJour: number): Promise<void> {
    // Formule sportive figée au lancement du tournoi (404 si l'édition n'existe pas).
    await this.editionVerrou.assertFormuleSportiveModifiable(editionId);
    return this.repository.delete(editionId, numeroJour);
  }
}
