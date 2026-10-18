import { Injectable, NotFoundException } from '@nestjs/common';
import type { InscEdition, ModePaiementRepas } from '@prisma/client';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { EditionResolverService } from '../shared/edition-resolver.service';
import {
  derivePaiementInscription,
  type PaiementInscription,
} from '../shared/paiement-inscription';

export interface CandidatureOrganisateurItem extends PaiementInscription {
  id: number;
  equipeNom: string;
  /** Lecture seule, tiré du référentiel : jamais recopié dans l'inscription. */
  equipeNomComplet: string | null;
  equipeLogoUrl: string | null;
  utilisateurEmail: string;
  utilisateurDisplayName: string | null;
  statut: string;
  createdAt: Date;
  repasDatePaiement: Date | null;
  repasModePaiement: ModePaiementRepas | null;
  commentaireOrganisateur: string | null;
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
        dossier: { include: { joueurs: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return inscriptions.map((i) => ({
      id: i.id,
      equipeNom: i.equipeNom,
      equipeNomComplet: i.equipeRef?.nomComplet ?? null,
      equipeLogoUrl: i.equipeRef?.logoUrl ?? null,
      utilisateurEmail: i.utilisateur.email,
      utilisateurDisplayName: i.utilisateur.displayName,
      statut: i.statut,
      createdAt: i.createdAt,
      repasDatePaiement: i.dossier?.datePaiementRepas ?? null,
      repasModePaiement: i.dossier?.repasModePaiement ?? null,
      commentaireOrganisateur: i.commentaireOrganisateur,
      ...derivePaiementInscription(i),
    }));
  }
}
