import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ModePaiementRepas } from '@prisma/client';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { MarquerPaiementRepasDto } from './dto/marquer-paiement-repas.dto';

export interface MarquerPaiementRepasResult {
  id: number;
  equipeNom: string;
  repasPaiementRecu: boolean;
  dateReceptionRepas: Date | null;
  datePaiementRepas: Date | null;
  repasModePaiement: ModePaiementRepas | null;
}

@Injectable()
export class MarquerPaiementRepasUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(
    id: number,
    dto: MarquerPaiementRepasDto,
  ): Promise<MarquerPaiementRepasResult> {
    const inscription = await this.prisma.inscInscription.findUnique({
      where: { id },
    });
    if (!inscription) {
      throw new NotFoundException('Candidature non trouvée');
    }

    if (dto.paye && (!dto.datePaiement || !dto.mode)) {
      throw new BadRequestException(
        'La date et le mode de paiement sont obligatoires',
      );
    }

    // dateReceptionRepas = horodatage technique de la saisie ;
    // datePaiementRepas = date de règlement déclarée par l'organisateur.
    const data = {
      repasPaiementRecu: dto.paye,
      dateReceptionRepas: dto.paye ? new Date() : null,
      datePaiementRepas: dto.paye ? new Date(dto.datePaiement!) : null,
      repasModePaiement: dto.paye ? dto.mode! : null,
    };

    const dossier = await this.prisma.inscDossier.upsert({
      where: { inscriptionId: id },
      update: data,
      create: { inscriptionId: id, ...data },
    });

    return {
      id: inscription.id,
      equipeNom: inscription.equipeNom,
      repasPaiementRecu: dossier.repasPaiementRecu,
      dateReceptionRepas: dossier.dateReceptionRepas,
      datePaiementRepas: dossier.datePaiementRepas,
      repasModePaiement: dossier.repasModePaiement,
    };
  }
}
