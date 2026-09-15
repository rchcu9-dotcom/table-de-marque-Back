import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  FORMAT_GRAPHE_REPOSITORY,
  FormatGrapheRepository,
} from '../../../domain/repositories/format-graphe.repository';
import { FormatPhase } from '../../../domain/entities/format/format-phase.entity';
import { ModifierPhaseDto } from '../../dto/format-graphe/modifier-phase.dto';

@Injectable()
export class ModifierPhaseUseCase {
  constructor(
    @Inject(FORMAT_GRAPHE_REPOSITORY)
    private readonly repo: FormatGrapheRepository,
  ) {}

  async execute(
    editionId: number,
    phaseId: number,
    dto: ModifierPhaseDto,
  ): Promise<FormatPhase> {
    const phase = await this.repo.updatePhase(phaseId, dto.nom);
    if (!phase) throw new NotFoundException(`Phase ${phaseId} introuvable`);
    await this.repo.marquerModifieManuellement(editionId);
    return phase;
  }
}
