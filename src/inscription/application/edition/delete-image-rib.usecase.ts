import { Injectable } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { EditionVerrouService } from '../shared/edition-verrou.service';
import { Edition } from '../../domain/entities/edition.entity';
import { toEditionEntity } from '../../infrastructure/persistence/edition.mapper';

@Injectable()
export class DeleteImageRibUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly editionVerrou: EditionVerrouService,
  ) {}

  async execute(editionId: number): Promise<Edition> {
    // Figés dès l'ouverture des inscriptions (404 si l'édition n'existe pas).
    await this.editionVerrou.assertParametresInscriptionModifiables(editionId);

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
