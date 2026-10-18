import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { Edition } from '../../domain/entities/edition.entity';
import { MESSAGE_RETOUR_AVEC_CANDIDATURES } from '../../domain/edition-regles';
import { ChangerEtapeEditionService } from './changer-etape-edition.service';

/**
 * INSCRIPTIONS_OUVERTES → Préparation, pour corriger des paramètres
 * d'inscription figés. Autorisé seulement tant qu'aucune équipe n'a candidaté.
 * État restauré : CREATION_NOUVEAU_TOURNOI s'il existe une édition plus
 * ancienne (cycle annuel : elle redevient l'édition publique, même critère
 * createdAt que EditionResolverService.getEditionActive), sinon CREEE.
 *
 * Une candidature soumise entre le comptage et le changement d'étape n'est
 * pas détectée (fenêtre de quelques ms, acceptée — cf. decisions.json).
 */
@Injectable()
export class RevenirEnPreparationUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly changerEtape: ChangerEtapeEditionService,
  ) {}

  async execute(id: number): Promise<Edition> {
    const existing = await this.prisma.inscEdition.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Édition ${id} introuvable`);
    }
    if (existing.etape !== 'INSCRIPTIONS_OUVERTES') {
      throw new ConflictException(
        `Transition d'étape interdite : ${existing.etape} → Préparation`,
      );
    }

    const nbCandidatures = await this.prisma.inscInscription.count({
      where: { editionId: id },
    });
    if (nbCandidatures > 0) {
      throw new ConflictException(MESSAGE_RETOUR_AVEC_CANDIDATURES);
    }

    const nbEditionsAnterieures = await this.prisma.inscEdition.count({
      where: { id: { not: id }, createdAt: { lt: existing.createdAt } },
    });
    return this.changerEtape.execute(
      id,
      nbEditionsAnterieures > 0 ? 'CREATION_NOUVEAU_TOURNOI' : 'CREEE',
    );
  }
}
