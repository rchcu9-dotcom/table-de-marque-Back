import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { InscriptionStatut } from '@prisma/client';
import { QuotaInscriptionService } from '../shared/quota-inscription.service';

@Injectable()
export class PromouvoCandidatureUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly quotaService: QuotaInscriptionService,
  ) {}

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

    await this.quotaService.verifierQuotaDisponible(inscription.editionId);

    const updated = await this.prisma.inscInscription.update({
      where: { id },
      data: { statut: InscriptionStatut.PAIEMENT_ATTENDU },
    });

    return { id: updated.id, statut: updated.statut };
  }
}
