import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  FORMAT_GRAPHE_REPOSITORY,
  FormatGrapheRepository,
} from '../../../domain/repositories/format-graphe.repository';
import { FormatPhase } from '../../../domain/entities/format/format-phase.entity';
import { ModifierPhaseDto } from '../../dto/format-graphe/modifier-phase.dto';
import { EditionVerrouService } from '@/inscription/application/shared/edition-verrou.service';

@Injectable()
export class ModifierPhaseUseCase {
  constructor(
    @Inject(FORMAT_GRAPHE_REPOSITORY)
    private readonly repo: FormatGrapheRepository,
    private readonly editionVerrou: EditionVerrouService,
  ) {}

  async execute(
    editionId: number,
    phaseId: number,
    dto: ModifierPhaseDto,
  ): Promise<FormatPhase> {
    // Formule sportive figée au lancement du tournoi (404 si l'édition n'existe pas).
    await this.editionVerrou.assertFormuleSportiveModifiable(editionId);
    const phase = await this.repo.updatePhase(phaseId, dto.nom);
    if (!phase) throw new NotFoundException(`Phase ${phaseId} introuvable`);
    await this.repo.marquerModifieManuellement(editionId);
    return phase;
  }
}
