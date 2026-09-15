import { Inject, Injectable } from '@nestjs/common';
import {
  FORMAT_GRAPHE_REPOSITORY,
  FormatGrapheRepository,
} from '../../../domain/repositories/format-graphe.repository';
import { FormatGroupe } from '../../../domain/entities/format/format-groupe.entity';
import { ModifierGroupeDto } from '../../dto/format-graphe/modifier-groupe.dto';

@Injectable()
export class ModifierGroupeUseCase {
  constructor(
    @Inject(FORMAT_GRAPHE_REPOSITORY)
    private readonly repo: FormatGrapheRepository,
  ) {}

  async execute(
    editionId: number,
    groupeId: number,
    dto: ModifierGroupeDto,
  ): Promise<FormatGroupe> {
    const groupe = await this.repo.updateGroupe(groupeId, {
      nom: dto.nom,
      formule: dto.formule,
    });
    await this.repo.marquerModifieManuellement(editionId);
    return groupe;
  }
}
