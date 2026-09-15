import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { EditionResolverService } from '../shared/edition-resolver.service';
import { InscInscription, InscriptionStatut } from '@prisma/client';

const STATUTS_DOSSIER_ACCESSIBLE: InscriptionStatut[] = [
  InscriptionStatut.VALIDEE,
  InscriptionStatut.DOSSIER_EN_COURS,
  InscriptionStatut.DOSSIER_COMPLET,
];

@Injectable()
export class DossierAccessService {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly editionResolver: EditionResolverService,
  ) {}

  async getInscriptionActivePourUtilisateur(
    providerUid: string,
  ): Promise<InscInscription> {
    const utilisateur = await this.prisma.inscUtilisateur.findUnique({
      where: { providerUid },
    });
    if (!utilisateur) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Pas de filtre sur l'édition/etape : un référent dont le dossier est
    // DOSSIER_EN_COURS doit garder l'accès même après la clôture des
    // inscriptions, jusqu'à ce que l'organisateur fige son dossier
    // (statut DOSSIER_COMPLET, seul verrou géré par assertDossierModifiable).
    const inscription = await this.prisma.inscInscription.findFirst({
      where: { utilisateurId: utilisateur.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!inscription) {
      throw new NotFoundException('Aucune candidature pour cet utilisateur');
    }

    if (!STATUTS_DOSSIER_ACCESSIBLE.includes(inscription.statut)) {
      throw new BadRequestException(
        "Le dossier n'est pas encore accessible pour cette inscription",
      );
    }

    return inscription;
  }

  /**
   * Deux garde-fous distincts (raisons différentes) : TOURNOI_DEMARRE vérifié
   * en premier pour que le message reflète la cause la plus actuelle quand
   * les deux conditions sont vraies en même temps.
   */
  async assertDossierModifiable(inscription: InscInscription): Promise<void> {
    const edition = await this.editionResolver.getEditionActive();
    if (edition.etape === 'TOURNOI_DEMARRE') {
      throw new BadRequestException(
        'Le tournoi a démarré, les dossiers ne sont plus modifiables.',
      );
    }

    if (inscription.statut === InscriptionStatut.DOSSIER_COMPLET) {
      throw new BadRequestException(
        "Le dossier est validé et ne peut plus être modifié. Contactez l'organisateur pour le rouvrir.",
      );
    }
  }

  /**
   * Garantit qu'un dossier existe pour l'inscription, et fait transiter
   * VALIDEE -> DOSSIER_EN_COURS lors de la première écriture.
   */
  async assurerDossierEnCours(inscription: InscInscription): Promise<number> {
    const dossier = await this.prisma.inscDossier.upsert({
      where: { inscriptionId: inscription.id },
      update: {},
      create: { inscriptionId: inscription.id },
    });

    if (inscription.statut === InscriptionStatut.VALIDEE) {
      await this.prisma.inscInscription.update({
        where: { id: inscription.id },
        data: { statut: InscriptionStatut.DOSSIER_EN_COURS },
      });
    }

    return dossier.id;
  }
}
