import { Injectable, NotFoundException } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

export interface ImageRibResult {
  data: Buffer;
  mimeType: string;
}

@Injectable()
export class GetImageRibUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(editionId: number): Promise<ImageRibResult> {
    const edition = await this.prisma.inscEdition.findUnique({
      where: { id: editionId },
      select: { imageRibData: true, imageRibMimeType: true },
    });

    if (!edition?.imageRibData || !edition.imageRibMimeType) {
      throw new NotFoundException('Aucune image RIB enregistrée');
    }

    return {
      data: Buffer.from(edition.imageRibData),
      mimeType: edition.imageRibMimeType,
    };
  }
}
