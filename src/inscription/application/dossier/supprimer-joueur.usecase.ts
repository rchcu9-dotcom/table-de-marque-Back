import { Injectable, NotFoundException } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { DossierAccessService } from './dossier-access.service';
import type { DossierActeur } from './dossier-acteur';

@Injectable()
export class SupprimerJoueurUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly dossierAccess: DossierAccessService,
  ) {}

  async execute(acteur: DossierActeur, joueurId: number): Promise<void> {
    const inscription =
      await this.dossierAccess.getInscriptionModifiable(acteur);

    const joueur = await this.prisma.inscJoueurDossier.findUnique({
      where: { id: joueurId },
      include: { dossier: true },
    });
    if (!joueur || joueur.dossier.inscriptionId !== inscription.id) {
      throw new NotFoundException('Joueur non trouvé');
    }

    await this.prisma.inscJoueurDossier.delete({ where: { id: joueurId } });
  }
}
