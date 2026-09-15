import { Injectable } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { DossierAccessService } from './dossier-access.service';
import {
  toDossierEntity,
  toJoueurDossierEntity,
  toCoachDossierEntity,
} from '../../infrastructure/persistence/dossier.mapper';
import { Dossier } from '../../domain/entities/dossier.entity';
import { JoueurDossier } from '../../domain/entities/joueur-dossier.entity';
import { CoachDossier } from '../../domain/entities/coach-dossier.entity';

export interface DossierComplet {
  dossier: Dossier | null;
  joueurs: JoueurDossier[];
  coachs: CoachDossier[];
  statutInscription: string;
}

@Injectable()
export class GetMonDossierUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly dossierAccess: DossierAccessService,
  ) {}

  async execute(providerUid: string): Promise<DossierComplet> {
    const inscription =
      await this.dossierAccess.getInscriptionActivePourUtilisateur(providerUid);

    const dossier = await this.prisma.inscDossier.findUnique({
      where: { inscriptionId: inscription.id },
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
