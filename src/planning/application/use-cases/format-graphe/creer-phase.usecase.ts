import { Inject, Injectable } from '@nestjs/common';
import {
  FORMAT_GRAPHE_REPOSITORY,
  FormatGrapheRepository,
} from '../../../domain/repositories/format-graphe.repository';
import { FormatPhase } from '../../../domain/entities/format/format-phase.entity';
import { CreerPhaseDto } from '../../dto/format-graphe/creer-phase.dto';
import { EditionVerrouService } from '@/inscription/application/shared/edition-verrou.service';

@Injectable()
export class CreerPhaseUseCase {
  constructor(
    @Inject(FORMAT_GRAPHE_REPOSITORY)
    private readonly repo: FormatGrapheRepository,
    private readonly editionVerrou: EditionVerrouService,
  ) {}

  async execute(editionId: number, dto: CreerPhaseDto): Promise<FormatPhase> {
    // Formule sportive figée au lancement du tournoi (404 si l'édition n'existe pas).
    await this.editionVerrou.assertFormuleSportiveModifiable(editionId);
    const phase = await this.repo.createPhase(editionId, dto.nom, dto.ordre);
    await this.repo.marquerModifieManuellement(editionId);
    return phase;
  }
}
