import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  FORMAT_GRAPHE_REPOSITORY,
  FormatGrapheRepository,
} from '../../../domain/repositories/format-graphe.repository';
import { FormatLien } from '../../../domain/entities/format/format-lien.entity';
import { DefinirLienDto } from '../../dto/format-graphe/definir-lien.dto';
import { EditionVerrouService } from '@/inscription/application/shared/edition-verrou.service';

@Injectable()
export class DefinirLienUseCase {
  constructor(
    @Inject(FORMAT_GRAPHE_REPOSITORY)
    private readonly repo: FormatGrapheRepository,
    private readonly editionVerrou: EditionVerrouService,
  ) {}

  async execute(
    editionId: number,
    groupeSourceId: number,
    rangSource: number,
    dto: DefinirLienDto,
  ): Promise<FormatLien> {
    // Formule sportive figée au lancement du tournoi (404 si l'édition n'existe pas).
    await this.editionVerrou.assertFormuleSportiveModifiable(editionId);
    // Validation CA4 : les phases doivent être consécutives.
    // La validation de la consécutivité est effectuée dans le repository Prisma
    // pour avoir accès aux données ; le repository lèvera une BadRequestException si non.
    const lien = await this.repo.definirLien(
      groupeSourceId,
      rangSource,
      dto.groupeCibleId,
    );
    if (!lien) {
      throw new BadRequestException(
        `Impossible de définir le lien : groupeSourceId=${groupeSourceId}, rangSource=${rangSource}`,
      );
    }
    await this.repo.marquerModifieManuellement(editionId);
    return lien;
  }
}
