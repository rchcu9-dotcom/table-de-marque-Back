import { Injectable, NotFoundException } from '@nestjs/common';
import { InscriptionPrismaService } from '@/inscription/infrastructure/persistence/inscription-prisma.service';
import { ParametresSportifs } from '../../domain/entities/parametres-sportifs.entity';
import { FormatPhaseFinale } from '../../domain/enums/format-phase-finale.enum';
import {
  MatriceDelaiMinActivite,
  ReglesTieBreak,
} from '../../domain/entities/parametres-sportifs.entity';

@Injectable()
export class GetParametresSportifsUseCase {
  constructor(private readonly inscriptionPrisma: InscriptionPrismaService) {}

  async execute(editionId: number): Promise<ParametresSportifs> {
    const edition = await this.inscriptionPrisma.inscEdition.findUnique({
      where: { id: editionId },
    });
    if (!edition) {
      throw new NotFoundException(`Édition ${editionId} introuvable`);
    }

    return new ParametresSportifs(
      edition.id,
      edition.dureeSurfacageMin,
      edition.dureeMatchPouleMin,
      edition.dureeMatchFinalMin,
      edition.dureeInterMatchMin ?? null,
      (edition.delaiMinActivite as MatriceDelaiMinActivite | null) ?? null,
      edition.nbPatinoires ?? null,
      edition.nbPoules ?? null,
      edition.nbEquipesParPoule ?? null,
      edition.nbEquipesQualifieesParPoule ?? null,
      (edition.formatPhaseFinale as FormatPhaseFinale | null) ?? null,
      (edition.reglesTieBreak as ReglesTieBreak | null) ?? null,
      edition.nbPlacesMax,
    );
  }
}
