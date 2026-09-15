import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { InscriptionStatut } from '@prisma/client';

export const STATUTS_ACTIFS: InscriptionStatut[] = [
  InscriptionStatut.RESERVEE,
  InscriptionStatut.PAIEMENT_ATTENDU,
  InscriptionStatut.VALIDEE,
  InscriptionStatut.DOSSIER_EN_COURS,
  InscriptionStatut.DOSSIER_COMPLET,
];

@Injectable()
export class QuotaInscriptionService {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async countInscriptionsActives(editionId: number): Promise<number> {
    return this.prisma.inscInscription.count({
      where: { editionId, statut: { in: STATUTS_ACTIFS } },
    });
  }

  async verifierQuotaDisponible(editionId: number): Promise<void> {
    const edition = await this.prisma.inscEdition.findUnique({
      where: { id: editionId },
    });
    if (!edition) {
      throw new NotFoundException('Édition non trouvée');
    }

    const nbActives = await this.countInscriptionsActives(editionId);
    if (nbActives >= edition.nbPlacesMax) {
      throw new BadRequestException(
        `Le nombre maximum d'équipes (${edition.nbPlacesMax}) est atteint`,
      );
    }
  }
}
