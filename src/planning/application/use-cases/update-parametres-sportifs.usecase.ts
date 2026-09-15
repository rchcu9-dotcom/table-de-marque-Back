import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InscriptionPrismaService } from '@/inscription/infrastructure/persistence/inscription-prisma.service';
import { UpdateParametresSportifsDto } from '../dto/update-parametres-sportifs.dto';
import { GetParametresSportifsUseCase } from './get-parametres-sportifs.usecase';
import { ParametresSportifs } from '../../domain/entities/parametres-sportifs.entity';

@Injectable()
export class UpdateParametresSportifsUseCase {
  constructor(
    private readonly inscriptionPrisma: InscriptionPrismaService,
    private readonly getParametresSportifs: GetParametresSportifsUseCase,
  ) {}

  async execute(
    editionId: number,
    dto: UpdateParametresSportifsDto,
  ): Promise<ParametresSportifs> {
    const existing = await this.inscriptionPrisma.inscEdition.findUnique({
      where: { id: editionId },
    });
    if (!existing) {
      throw new NotFoundException(`Édition ${editionId} introuvable`);
    }

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
