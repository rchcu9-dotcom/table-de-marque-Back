import { Inject, Injectable } from '@nestjs/common';
import {
  FORMAT_GRAPHE_REPOSITORY,
  FormatGrapheRepository,
} from '../../../domain/repositories/format-graphe.repository';
import { FormatLien } from '../../../domain/entities/format/format-lien.entity';
import { EditionVerrouService } from '@/inscription/application/shared/edition-verrou.service';

@Injectable()
export class ReinitialiserLienUseCase {
  constructor(
    @Inject(FORMAT_GRAPHE_REPOSITORY)
    private readonly repo: FormatGrapheRepository,
    private readonly editionVerrou: EditionVerrouService,
  ) {}

  async execute(
    editionId: number,
    groupeSourceId: number,
    rangSource: number,
  ): Promise<FormatLien> {
    // Formule sportive figée au lancement du tournoi (404 si l'édition n'existe pas).
    await this.editionVerrou.assertFormuleSportiveModifiable(editionId);
    const lien = await this.repo.reinitialiserLien(groupeSourceId, rangSource);
    await this.repo.marquerModifieManuellement(editionId);
    return lien;
  }
}
