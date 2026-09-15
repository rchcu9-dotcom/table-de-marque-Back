import { Injectable, NotFoundException } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { EditionResolverService } from '../shared/edition-resolver.service';

export interface MaCandidatureResult {
  id: number;
  equipeNom: string;
  equipeLogoUrl: string | null;
  statut: string;
  createdAt: Date;
}

@Injectable()
export class GetMaCandidatureUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly editionResolver: EditionResolverService,
  ) {}

  async execute(providerUid: string): Promise<MaCandidatureResult | null> {
    const utilisateur = await this.prisma.inscUtilisateur.findUnique({
      where: { providerUid },
    });
    if (!utilisateur) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const edition = await this.editionResolver.getEditionActive();

    const inscription = await this.prisma.inscInscription.findFirst({
      where: { editionId: edition.id, utilisateurId: utilisateur.id },
      include: { equipeRef: true },
    });
    if (!inscription) {
      throw new NotFoundException('Aucune candidature pour cette édition');
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
