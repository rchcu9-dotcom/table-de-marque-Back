import { Inject, Injectable } from '@nestjs/common';
import {
  FORMAT_GRAPHE_REPOSITORY,
  FormatGrapheRepository,
} from '../../../domain/repositories/format-graphe.repository';
import { FormatGroupe } from '../../../domain/entities/format/format-groupe.entity';
import { CreerGroupeDto } from '../../dto/format-graphe/creer-groupe.dto';

@Injectable()
export class CreerGroupeUseCase {
  constructor(
    @Inject(FORMAT_GRAPHE_REPOSITORY)
    private readonly repo: FormatGrapheRepository,
  ) {}

  async execute(
    editionId: number,
    phaseId: number,
    dto: CreerGroupeDto,
  ): Promise<FormatGroupe> {
    const groupe = await this.repo.createGroupe(phaseId, dto.nom);
    await this.repo.marquerModifieManuellement(editionId);
    return groupe;
  }
}
