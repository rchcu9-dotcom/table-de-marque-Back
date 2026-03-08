import { Injectable, NotFoundException } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

export interface MaCandidatureResult {
  id: number;
  equipeNom: string;
  equipeLogoUrl: string | null;
  statut: string;
  createdAt: Date;
}

@Injectable()
export class GetMaCandidatureUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(firebaseUid: string): Promise<MaCandidatureResult | null> {
    const utilisateur = await this.prisma.inscUtilisateur.findUnique({
      where: { firebaseUid },
    });
    if (!utilisateur) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Édition courante (non clôturée)
    const edition = await this.prisma.inscEdition.findFirst({
      where: { etape: { not: 'CLOTUREE' } },
      orderBy: { createdAt: 'desc' },
    });
    if (!edition) {
      return null;
    }

    const inscription = await this.prisma.inscInscription.findFirst({
      where: { editionId: edition.id, utilisateurId: utilisateur.id },
      include: { equipeRef: true },
    });
    if (!inscription) {
      return null;
    }

    return {
      id: inscription.id,
      equipeNom: inscription.equipeNom,
      equipeLogoUrl: inscription.equipeRef?.logoUrl ?? null,
      statut: inscription.statut,
      createdAt: inscription.createdAt,
    };
  }
}
