import { Inject, Injectable } from '@nestjs/common';
import {
  FORMAT_GRAPHE_REPOSITORY,
  FormatGrapheRepository,
} from '../../../domain/repositories/format-graphe.repository';
import { FormatGraphe } from '../../../domain/entities/format/format-graphe.entity';
import { GetParametresSportifsUseCase } from '../get-parametres-sportifs.usecase';
import { FormatPresetGeneratorService } from '../../services/format-preset-generator.service';
import { FormatPhaseFinale } from '../../../domain/enums/format-phase-finale.enum';
import {
  DEFAULT_NB_EQUIPES_QUALIFIEES_PAR_POULE,
  DEFAULT_NB_POULES,
} from '../../services/default-parametres';

@Injectable()
export class GetFormatGrapheUseCase {
  constructor(
    @Inject(FORMAT_GRAPHE_REPOSITORY)
    private readonly repo: FormatGrapheRepository,
    private readonly getParametresSportifs: GetParametresSportifsUseCase,
    private readonly presetGenerator: FormatPresetGeneratorService,
  ) {}

  async execute(editionId: number): Promise<FormatGraphe> {
    const graphe = await this.repo.getGraphe(editionId);

    // Migration lazy : si aucune Phase n'existe pour l'édition, génère un
    // graphe équivalent depuis les colonnes plates encore présentes.
    if (graphe.phases.length === 0) {
      const parametres = await this.getParametresSportifs.execute(editionId);
      const preset =
        parametres.formatPhaseFinale ?? FormatPhaseFinale.ELIMINATION_DIRECTE;
      const nbPoules = parametres.nbPoules ?? DEFAULT_NB_POULES;
      const nbEquipesParPoule =
        parametres.nbEquipesParPoule ??
        Math.ceil(parametres.nbPlacesMax / nbPoules);
      const nbEquipesQualifieesParPoule =
        parametres.nbEquipesQualifieesParPoule ??
        DEFAULT_NB_EQUIPES_QUALIFIEES_PAR_POULE;

      const propose = this.presetGenerator.genererGraphe(preset, {
        nbPoules,
        nbEquipesParPoule,
        nbEquipesQualifieesParPoule,
      });

      return this.repo.remplacerGrapheComplet(editionId, propose);
    }

    return graphe;
  }
}
