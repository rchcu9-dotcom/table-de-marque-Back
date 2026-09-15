import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { InscriptionStatut } from '@prisma/client';

@Injectable()
export class RouvrirDossierUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(id: number): Promise<{ id: number; statut: string }> {
    const inscription = await this.prisma.inscInscription.findUnique({
      where: { id },
    });
    if (!inscription) {
      throw new NotFoundException('Candidature non trouvée');
    }
    if (inscription.statut !== InscriptionStatut.DOSSIER_COMPLET) {
      throw new BadRequestException(
        'Seul un dossier complet peut être rouvert',
      );
    }

    const updated = await this.prisma.inscInscription.update({
      where: { id },
      data: { statut: InscriptionStatut.DOSSIER_EN_COURS },
    });

    return { id: updated.id, statut: updated.statut };
  }
}
