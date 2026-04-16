import { Injectable, NotFoundException } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { Edition } from '../../domain/entities/edition.entity';
import { toEditionEntity } from '../../infrastructure/persistence/edition.mapper';

@Injectable()
export class GetEditionCouranteUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(): Promise<Edition> {
    const edition = await this.prisma.inscEdition.findFirst({
      where: {
        etape: { not: 'CLOTUREE' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!edition) {
      throw new NotFoundException('Aucune édition active trouvée');
    }

    return toEditionEntity(edition);
  }
}
