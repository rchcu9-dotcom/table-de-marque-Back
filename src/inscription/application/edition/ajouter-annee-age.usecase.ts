import { Injectable } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { EditionVerrouService } from '../shared/edition-verrou.service';
import { Edition } from '../../domain/entities/edition.entity';
import { toEditionEntity } from '../../infrastructure/persistence/edition.mapper';
import { AjouterAnneeAgeDto } from './dto/ajouter-annee-age.dto';

export { AjouterAnneeAgeDto };

@Injectable()
export class AjouterAnneeAgeUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly editionVerrou: EditionVerrouService,
  ) {}

  async execute(editionId: number, dto: AjouterAnneeAgeDto): Promise<Edition> {
    // Figés dès l'ouverture des inscriptions (404 si l'édition n'existe pas).
    await this.editionVerrou.assertParametresInscriptionModifiables(editionId);

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
