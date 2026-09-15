import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { Edition } from '../../domain/entities/edition.entity';
import { toEditionEntity } from '../../infrastructure/persistence/edition.mapper';

/**
 * Seule voie autorisée pour atteindre TOURNOI_DEMARRE (cf. spec §6) :
 * transition CLOTUREE -> TOURNOI_DEMARRE uniquement, aucun retour arrière.
 */
@Injectable()
export class DemarrerTournoiUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(id: number): Promise<Edition> {
    const existing = await this.prisma.inscEdition.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Édition ${id} introuvable`);
    }

    if (existing.etape !== 'CLOTUREE') {
      throw new BadRequestException(
        "Le tournoi ne peut être démarré que depuis l'étape CLOTUREE.",
      );
    }

    const updated = await this.prisma.inscEdition.update({
      where: { id },
      data: { etape: 'TOURNOI_DEMARRE' },
      include: { anneesAge: true },
    });

    return toEditionEntity(updated);
  }
}
