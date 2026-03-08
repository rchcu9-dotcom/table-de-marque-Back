import { Injectable } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

export interface CandidatureOrganisateurItem {
  id: number;
  equipeNom: string;
  equipeLogoUrl: string | null;
  utilisateurEmail: string;
  utilisateurDisplayName: string | null;
  statut: string;
  createdAt: Date;
}

@Injectable()
export class GetToutesCandidaturesUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(): Promise<CandidatureOrganisateurItem[]> {
    // Édition courante (non clôturée)
    const edition = await this.prisma.inscEdition.findFirst({
      where: { etape: { not: 'CLOTUREE' } },
      orderBy: { createdAt: 'desc' },
    });
    if (!edition) {
      return [];
    }

    const inscriptions = await this.prisma.inscInscription.findMany({
      where: { editionId: edition.id },
      include: {
        utilisateur: true,
        equipeRef: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return inscriptions.map((i) => ({
      id: i.id,
      equipeNom: i.equipeNom,
      equipeLogoUrl: i.equipeRef?.logoUrl ?? null,
      utilisateurEmail: i.utilisateur.email,
      utilisateurDisplayName: i.utilisateur.displayName,
      statut: i.statut,
      createdAt: i.createdAt,
    }));
  }
}
