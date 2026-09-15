import { Injectable, NotFoundException } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { Edition } from '../../domain/entities/edition.entity';
import { toEditionEntity } from '../../infrastructure/persistence/edition.mapper';

@Injectable()
export class RetirerAnneeAgeUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(editionId: number, annee: number): Promise<Edition> {
    const existing = await this.prisma.inscEdition.findUnique({
      where: { id: editionId },
    });
    if (!existing) {
      throw new NotFoundException(`Édition ${editionId} introuvable`);
    }

    // Pas de garde-fou si des dossiers joueurs référencent déjà cette année :
    // même tolérance que celle actée pour les postes hors énumération (spec
    // "Dossiers historiques") — seule la saisie future est contrainte.
    await this.prisma.inscEditionAnneeAge.deleteMany({
      where: { editionId, annee },
    });

    const edition = await this.prisma.inscEdition.findUniqueOrThrow({
      where: { id: editionId },
      include: { anneesAge: true },
    });

    return toEditionEntity(edition);
  }
}
