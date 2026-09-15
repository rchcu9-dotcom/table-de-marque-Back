import { Inject, Injectable } from '@nestjs/common';
import {
  FORMAT_GRAPHE_REPOSITORY,
  FormatGrapheRepository,
} from '../../../domain/repositories/format-graphe.repository';
import { FormatPlace } from '../../../domain/entities/format/format-place.entity';
import { AjouterPlaceAliasDto } from '../../dto/format-graphe/ajouter-place-alias.dto';

@Injectable()
export class AjouterPlaceAliasUseCase {
  constructor(
    @Inject(FORMAT_GRAPHE_REPOSITORY)
    private readonly repo: FormatGrapheRepository,
  ) {}

  async execute(
    editionId: number,
    groupeId: number,
    dto: AjouterPlaceAliasDto,
  ): Promise<FormatPlace> {
    const place = await this.repo.ajouterPlaceAlias(groupeId, dto.aliasLabel);
    await this.repo.marquerModifieManuellement(editionId);
    return place;
  }
}
