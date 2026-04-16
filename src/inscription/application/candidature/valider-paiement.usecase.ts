import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { InscriptionStatut } from '@prisma/client';
import { ValiderPaiementDto } from './dto/valider-paiement.dto';

export interface ValiderPaiementResult {
  id: number;
  equipeNom: string;
  statut: string;
  dateVirementInscription: Date;
  updatedAt: Date;
}

@Injectable()
export class ValiderPaiementUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(
    id: number,
    dto: ValiderPaiementDto,
  ): Promise<ValiderPaiementResult> {
    const inscription = await this.prisma.inscInscription.findUnique({
      where: { id },
      include: { dossier: true },
    });
    if (!inscription) {
      throw new NotFoundException('Candidature non trouvée');
    }
    if (inscription.statut !== InscriptionStatut.PAIEMENT_ATTENDU) {
      throw new BadRequestException(
        'Seule une candidature en statut PAIEMENT_ATTENDU peut être validée',
      );
    }

    const dateVirement = new Date(dto.dateVirement);

    // Mettre à jour statut → VALIDEE
    const updatedInscription = await this.prisma.inscInscription.update({
      where: { id },
      data: { statut: InscriptionStatut.VALIDEE },
    });

    // Créer ou mettre à jour le dossier avec la date de virement
    await this.prisma.inscDossier.upsert({
      where: { inscriptionId: id },
      update: { dateVirementInscription: dateVirement },
      create: {
        inscriptionId: id,
        dateVirementInscription: dateVirement,
      },
    });

    return {
      id: updatedInscription.id,
      equipeNom: updatedInscription.equipeNom,
      statut: updatedInscription.statut,
      dateVirementInscription: dateVirement,
      updatedAt: updatedInscription.updatedAt,
    };
  }
}
