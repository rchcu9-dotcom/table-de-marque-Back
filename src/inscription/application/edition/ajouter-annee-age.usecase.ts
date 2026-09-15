import { Injectable, NotFoundException } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { Edition } from '../../domain/entities/edition.entity';
import { toEditionEntity } from '../../infrastructure/persistence/edition.mapper';
import { AjouterAnneeAgeDto } from './dto/ajouter-annee-age.dto';

export { AjouterAnneeAgeDto };

@Injectable()
export class AjouterAnneeAgeUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(editionId: number, dto: AjouterAnneeAgeDto): Promise<Edition> {
    const existing = await this.prisma.inscEdition.findUnique({
      where: { id: editionId },
    });
    if (!existing) {
      throw new NotFoundException(`Édition ${editionId} introuvable`);
    }

    // upsert plutôt que create : ajouter deux fois la même année est
    // idempotent, pas une erreur (@@unique([editionId, annee])).
    await this.prisma.inscEditionAnneeAge.upsert({
      where: { editionId_annee: { editionId, annee: dto.annee } },
      create: { editionId, annee: dto.annee },
      update: {},
    });

    const edition = await this.prisma.inscEdition.findUniqueOrThrow({
      where: { id: editionId },
      include: { anneesAge: true },
    });

    return toEditionEntity(edition);
  }
}
