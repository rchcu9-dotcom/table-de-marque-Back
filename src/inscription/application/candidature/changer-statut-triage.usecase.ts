import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { InscriptionStatut } from '@prisma/client';
import { QuotaInscriptionService } from '../shared/quota-inscription.service';
import { ChangerStatutTriageDto } from './dto/changer-statut-triage.dto';

export const STATUTS_TRIAGE: InscriptionStatut[] = [
  InscriptionStatut.CANDIDATE,
  InscriptionStatut.PAIEMENT_ATTENDU,
  InscriptionStatut.LISTE_ATTENTE,
  InscriptionStatut.REFUSEE,
];

@Injectable()
export class ChangerStatutTriageUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly quotaService: QuotaInscriptionService,
  ) {}

  async execute(
    id: number,
    dto: ChangerStatutTriageDto,
  ): Promise<{ id: number; statut: string }> {
    const inscription = await this.prisma.inscInscription.findUnique({
      where: { id },
    });
    if (!inscription) {
      throw new NotFoundException('Candidature non trouvée');
    }

    if (!STATUTS_TRIAGE.includes(inscription.statut)) {
      throw new BadRequestException(
        'Seule une candidature en phase de triage (candidate, paiement attendu, liste ' +
          "d'attente ou refusée) peut changer de statut via ce mécanisme",
      );
    }

    if (dto.statut === inscription.statut) {
      return { id: inscription.id, statut: inscription.statut };
    }

    if (
      dto.statut === InscriptionStatut.PAIEMENT_ATTENDU &&
      inscription.statut !== InscriptionStatut.PAIEMENT_ATTENDU
    ) {
      await this.quotaService.verifierQuotaDisponible(inscription.editionId);
    }

    const updated = await this.prisma.inscInscription.update({
      where: { id },
      data: { statut: dto.statut },
    });

    return { id: updated.id, statut: updated.statut };
  }
}
