import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { InscriptionStatut } from '@prisma/client';

const MAX_EQUIPES_RESERVEES = 16;

const STATUTS_ACTIFS: InscriptionStatut[] = [
  InscriptionStatut.RESERVEE,
  InscriptionStatut.PAIEMENT_ATTENDU,
  InscriptionStatut.VALIDEE,
  InscriptionStatut.DOSSIER_EN_COURS,
  InscriptionStatut.DOSSIER_COMPLET,
];

@Injectable()
export class PromouvoCandidatureUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(id: number): Promise<{ id: number; statut: string }> {
    const inscription = await this.prisma.inscInscription.findUnique({
      where: { id },
    });
    if (!inscription) {
      throw new NotFoundException('Candidature non trouvée');
    }
    if (inscription.statut !== InscriptionStatut.LISTE_ATTENTE) {
      throw new BadRequestException(
        "Seule une candidature en liste d'attente peut être promue",
      );
    }

    const nbActives = await this.prisma.inscInscription.count({
      where: {
        editionId: inscription.editionId,
        statut: { in: STATUTS_ACTIFS },
      },
    });
    if (nbActives >= MAX_EQUIPES_RESERVEES) {
      throw new BadRequestException(
        `Le nombre maximum d'équipes (${MAX_EQUIPES_RESERVEES}) est atteint`,
      );
    }

    const updated = await this.prisma.inscInscription.update({
      where: { id },
      data: { statut: InscriptionStatut.PAIEMENT_ATTENDU },
    });

    return { id: updated.id, statut: updated.statut };
  }
}
