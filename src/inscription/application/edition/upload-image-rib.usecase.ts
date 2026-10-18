import { BadRequestException, Injectable } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { EditionVerrouService } from '../shared/edition-verrou.service';
import { Edition } from '../../domain/entities/edition.entity';
import { toEditionEntity } from '../../infrastructure/persistence/edition.mapper';
import {
  IMAGE_RIB_ALLOWED_MIME_TYPES,
  IMAGE_RIB_MAX_SIZE_BYTES,
} from './image-rib.constants';

export interface UploadImageRibFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Injectable()
export class UploadImageRibUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly editionVerrou: EditionVerrouService,
  ) {}

  async execute(editionId: number, file: UploadImageRibFile): Promise<Edition> {
    // Figés dès l'ouverture des inscriptions (404 si l'édition n'existe pas).
    await this.editionVerrou.assertParametresInscriptionModifiables(editionId);

    if (
      !IMAGE_RIB_ALLOWED_MIME_TYPES.includes(
        file.mimetype as (typeof IMAGE_RIB_ALLOWED_MIME_TYPES)[number],
      )
    ) {
      throw new BadRequestException(
        `Type de fichier non autorisé (${file.mimetype}) : formats acceptés PNG, JPEG, WEBP`,
      );
    }
    if (file.size > IMAGE_RIB_MAX_SIZE_BYTES) {
      throw new BadRequestException(
        `Fichier trop volumineux (${file.size} octets) : taille maximale ${IMAGE_RIB_MAX_SIZE_BYTES} octets`,
      );
    }

    const updated = await this.prisma.inscEdition.update({
      where: { id: editionId },
      data: {
        imageRibData: new Uint8Array(file.buffer),
        imageRibMimeType: file.mimetype,
        imageRibUpdatedAt: new Date(),
      },
      include: { anneesAge: true },
    });

    return toEditionEntity(updated);
  }
}
