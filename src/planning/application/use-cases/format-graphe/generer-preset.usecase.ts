import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  FORMAT_GRAPHE_REPOSITORY,
  FormatGrapheRepository,
} from '../../../domain/repositories/format-graphe.repository';
import { FormatGraphe } from '../../../domain/entities/format/format-graphe.entity';
import { FormatPresetGeneratorService } from '../../services/format-preset-generator.service';
import { GenererPresetDto } from '../../dto/format-graphe/generer-preset.dto';

@Injectable()
export class GenererPresetUseCase {
  constructor(
    @Inject(FORMAT_GRAPHE_REPOSITORY)
    private readonly repo: FormatGrapheRepository,
    private readonly presetGenerator: FormatPresetGeneratorService,
  ) {}

  async execute(
    editionId: number,
    dto: GenererPresetDto,
  ): Promise<FormatGraphe> {
    // Critère d'acceptation 5 : non-régénération destructive des modifications manuelles.
    const meta = await this.repo.getMeta(editionId);
    if (meta?.modifieManuellement && !dto.forcer) {
      throw new ConflictException(
        'Le graphe a été modifié manuellement depuis la dernière génération. ' +
          'Passez forcer=true pour écraser les modifications.',
      );
    }

    const propose = this.presetGenerator.genererGraphe(dto.preset, {
      nbPoules: dto.nbPoules,
      nbEquipesParPoule: dto.nbEquipesParPoule,
      nbEquipesQualifieesParPoule: dto.nbEquipesQualifieesParPoule,
    });

    const graphe = await this.repo.remplacerGrapheComplet(editionId, propose);
    // genererDepuisPreset = preset choisi, modifieManuellement = false
    // (remplacerGrapheComplet le remet à false via FormatMeta)
    return graphe;
  }
}
