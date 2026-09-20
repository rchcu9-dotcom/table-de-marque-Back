import { Injectable, NotFoundException } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { Edition } from '../../domain/entities/edition.entity';
import { toEditionEntity } from '../../infrastructure/persistence/edition.mapper';

@Injectable()
export class DeleteImageRibUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(editionId: number): Promise<Edition> {
    const existing = await this.prisma.inscEdition.findUnique({
      where: { id: editionId },
    });
    if (!existing) {
      throw new NotFoundException(`Édition ${editionId} introuvable`);
    }

    const updated = await this.prisma.inscEdition.update({
      where: { id: editionId },
      data: {
        imageRibData: null,
        imageRibMimeType: null,
        imageRibUpdatedAt: null,
      },
      include: { anneesAge: true },
    });

    return toEditionEntity(updated);
  }
}
