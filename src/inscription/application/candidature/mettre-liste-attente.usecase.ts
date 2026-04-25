import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { InscriptionStatut } from '@prisma/client';

@Injectable()
export class MettreListeAttenteUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(id: number): Promise<{ id: number; statut: string }> {
    const inscription = await this.prisma.inscInscription.findUnique({
      where: { id },
    });
    if (!inscription) {
      throw new NotFoundException('Candidature non trouvée');
    }
    if (inscription.statut !== InscriptionStatut.CANDIDATE) {
      throw new BadRequestException(
        "Seule une candidature en statut CANDIDATE peut être mise en liste d'attente",
      );
    }

    const updated = await this.prisma.inscInscription.update({
      where: { id },
      data: { statut: InscriptionStatut.LISTE_ATTENTE },
    });

    return { id: updated.id, statut: updated.statut };
  }
}
