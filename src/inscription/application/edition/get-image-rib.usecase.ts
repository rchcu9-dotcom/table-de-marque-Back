import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { InscriptionStatut } from '@prisma/client';
import type { CurrentUserPayload } from '../../../auth/decorators/current-user.decorator';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

export interface ImageRibResult {
  data: Buffer;
  mimeType: string;
}

/**
 * Statuts de candidature pour lesquels InscriptionPage affiche le RIB
 * (paiement attendu) : seuls ces responsables ont besoin des coordonnées
 * bancaires du club.
 */
export const STATUTS_ACCES_IMAGE_RIB: InscriptionStatut[] = [
  'RESERVEE',
  'PAIEMENT_ATTENDU',
];

@Injectable()
export class GetImageRibUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(
    editionId: number,
    user: Pick<CurrentUserPayload, 'id' | 'role'>,
  ): Promise<ImageRibResult> {
    if (user.role !== 'ORGANISATEUR') {
      const inscription = await this.prisma.inscInscription.findFirst({
        where: {
          editionId,
          utilisateurId: user.id,
          statut: { in: STATUTS_ACCES_IMAGE_RIB },
        },
        select: { id: true },
      });
      if (!inscription) {
        throw new ForbiddenException("Accès à l'image RIB non autorisé");
      }
    }

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
