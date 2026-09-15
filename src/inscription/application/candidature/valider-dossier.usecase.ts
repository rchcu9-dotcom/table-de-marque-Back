import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { InscriptionStatut } from '@prisma/client';

@Injectable()
export class ValiderDossierUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(id: number): Promise<{ id: number; statut: string }> {
    const inscription = await this.prisma.inscInscription.findUnique({
      where: { id },
      include: { dossier: { include: { joueurs: true, coachs: true } } },
    });
    if (!inscription) {
      throw new NotFoundException('Candidature non trouvée');
    }
    if (inscription.statut !== InscriptionStatut.DOSSIER_EN_COURS) {
      throw new BadRequestException(
        'Seul un dossier en cours peut être validé',
      );
    }

    const dossier = inscription.dossier;
    const manquants: string[] = [];
    if (!dossier || dossier.joueurs.length === 0) {
      manquants.push('au moins un joueur');
    }
    if (!dossier || dossier.coachs.length === 0) {
      manquants.push('au moins un coach');
    }
    if (!dossier?.droitsImageAcceptes) {
      manquants.push("l'acceptation des droits à l'image");
    }
    if (manquants.length > 0) {
      throw new BadRequestException(
        `Le dossier est incomplet : ${manquants.join(', ')}`,
      );
    }

    const updated = await this.prisma.inscInscription.update({
      where: { id },
      data: { statut: InscriptionStatut.DOSSIER_COMPLET },
    });

    return { id: updated.id, statut: updated.statut };
  }
}
