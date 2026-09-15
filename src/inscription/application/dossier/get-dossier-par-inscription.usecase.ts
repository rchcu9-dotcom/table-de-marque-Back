import { Injectable, NotFoundException } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import {
  toDossierEntity,
  toJoueurDossierEntity,
  toCoachDossierEntity,
} from '../../infrastructure/persistence/dossier.mapper';
import { DossierComplet } from './get-mon-dossier.usecase';

@Injectable()
export class GetDossierParInscriptionUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(inscriptionId: number): Promise<DossierComplet> {
    const inscription = await this.prisma.inscInscription.findUnique({
      where: { id: inscriptionId },
    });
    if (!inscription) {
      throw new NotFoundException('Candidature non trouvée');
    }

    const dossier = await this.prisma.inscDossier.findUnique({
      where: { inscriptionId },
      include: { joueurs: true, coachs: true },
    });

    if (!dossier) {
      return {
        dossier: null,
        joueurs: [],
        coachs: [],
        statutInscription: inscription.statut,
      };
    }

    return {
      dossier: toDossierEntity(dossier),
      joueurs: dossier.joueurs.map(toJoueurDossierEntity),
      coachs: dossier.coachs.map(toCoachDossierEntity),
      statutInscription: inscription.statut,
    };
  }
}
