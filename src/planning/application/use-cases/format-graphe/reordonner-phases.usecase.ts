import { Inject, Injectable } from '@nestjs/common';
import {
  FORMAT_GRAPHE_REPOSITORY,
  FormatGrapheRepository,
} from '../../../domain/repositories/format-graphe.repository';
import { ReordonnerPhasesDto } from '../../dto/format-graphe/reordonner-phases.dto';
import { EditionVerrouService } from '@/inscription/application/shared/edition-verrou.service';

@Injectable()
export class ReordonnerPhasesUseCase {
  constructor(
    @Inject(FORMAT_GRAPHE_REPOSITORY)
    private readonly repo: FormatGrapheRepository,
    private readonly editionVerrou: EditionVerrouService,
  ) {}

  async execute(editionId: number, dto: ReordonnerPhasesDto): Promise<void> {
    // Formule sportive figée au lancement du tournoi (404 si l'édition n'existe pas).
    await this.editionVerrou.assertFormuleSportiveModifiable(editionId);
    await this.repo.reordonnerPhases(editionId, dto.ordreIds);
    await this.repo.marquerModifieManuellement(editionId);
  }
}
