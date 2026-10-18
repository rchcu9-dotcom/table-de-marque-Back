import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InscriptionPrismaService } from '@/inscription/infrastructure/persistence/inscription-prisma.service';
import { UpdateParametresSportifsDto } from '../dto/update-parametres-sportifs.dto';
import { GetParametresSportifsUseCase } from './get-parametres-sportifs.usecase';
import { ParametresSportifs } from '../../domain/entities/parametres-sportifs.entity';
import { EditionVerrouService } from '@/inscription/application/shared/edition-verrou.service';

@Injectable()
export class UpdateParametresSportifsUseCase {
  constructor(
    private readonly inscriptionPrisma: InscriptionPrismaService,
    private readonly getParametresSportifs: GetParametresSportifsUseCase,
    private readonly editionVerrou: EditionVerrouService,
  ) {}

  async execute(
    editionId: number,
    dto: UpdateParametresSportifsDto,
  ): Promise<ParametresSportifs> {
    // Formule sportive figée au lancement du tournoi (404 si l'édition n'existe pas).
    await this.editionVerrou.assertFormuleSportiveModifiable(editionId);
    const { delaiMinActivite, reglesTieBreak, ...reste } = dto;
    await this.inscriptionPrisma.inscEdition.update({
      where: { id: editionId },
      data: {
        ...reste,
        ...(delaiMinActivite !== undefined && {
          delaiMinActivite: delaiMinActivite ?? Prisma.JsonNull,
        }),
        ...(reglesTieBreak !== undefined && {
          reglesTieBreak: reglesTieBreak ?? Prisma.JsonNull,
        }),
      },
    });

    return this.getParametresSportifs.execute(editionId);
  }
}
