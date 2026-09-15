import { Injectable, NotFoundException } from '@nestjs/common';
import type { InscEdition } from '@prisma/client';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { EditionResolverService } from '../shared/edition-resolver.service';

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
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly editionResolver: EditionResolverService,
  ) {}

  async execute(): Promise<CandidatureOrganisateurItem[]> {
    let edition: InscEdition;
    try {
      edition = await this.editionResolver.getEditionActive();
    } catch (e) {
      if (e instanceof NotFoundException) {
        return [];
      }
      throw e;
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
