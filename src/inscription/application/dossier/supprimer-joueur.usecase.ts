import { Injectable, NotFoundException } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { DossierAccessService } from './dossier-access.service';

@Injectable()
export class SupprimerJoueurUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly dossierAccess: DossierAccessService,
  ) {}

  async execute(providerUid: string, joueurId: number): Promise<void> {
    const inscription =
      await this.dossierAccess.getInscriptionActivePourUtilisateur(providerUid);
    await this.dossierAccess.assertDossierModifiable(inscription);

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
