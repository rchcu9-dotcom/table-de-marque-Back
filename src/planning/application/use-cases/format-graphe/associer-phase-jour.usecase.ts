import { Inject, Injectable } from '@nestjs/common';
import {
  FORMAT_GRAPHE_REPOSITORY,
  FormatGrapheRepository,
} from '../../../domain/repositories/format-graphe.repository';
import { AssocierPhaseJourDto } from '../../dto/format-graphe/associer-phase-jour.dto';
import { EditionVerrouService } from '@/inscription/application/shared/edition-verrou.service';

@Injectable()
export class AssocierPhaseJourUseCase {
  constructor(
    @Inject(FORMAT_GRAPHE_REPOSITORY)
    private readonly repo: FormatGrapheRepository,
    private readonly editionVerrou: EditionVerrouService,
  ) {}

  async execute(
    editionId: number,
    phaseId: number,
    dto: AssocierPhaseJourDto,
  ): Promise<void> {
    // Formule sportive figée au lancement du tournoi (404 si l'édition n'existe pas).
    await this.editionVerrou.assertFormuleSportiveModifiable(editionId);
    await this.repo.associerPhaseJour(phaseId, dto.editionJourId);
    await this.repo.marquerModifieManuellement(editionId);
  }
}
