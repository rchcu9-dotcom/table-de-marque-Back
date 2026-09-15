import { Injectable, NotFoundException } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import type { InscEditionAvecAnneesAge } from '../../infrastructure/persistence/edition.mapper';

/**
 * Résout "l'édition active" pour toute lecture, indépendamment de `etape`.
 *
 * Contrairement à un filtre `etape !== CLOTUREE`, une édition CLOTUREE reste
 * l'édition active tant qu'aucune édition plus récente n'existe : les
 * référents et organisateurs doivent continuer à agir sur leurs dossiers
 * après la fermeture des inscriptions (cf. docs/specs/-contexte-le-backend-
 * et-le-frontend-de-lapplication-de-tourn.track.md, section Arch).
 *
 * Hypothèse : une seule édition est active à la fois (1 tournoi par an).
 * Le recouvrement entre une édition CLOTUREE encore en traitement et une
 * nouvelle édition CREEE en parallèle est hors périmètre ici.
 *
 * Depuis le cycle annuel de l'édition (docs/specs/title-cycle-annuel-de-
 * ldition-dump-obligatoire-prparation-de.md §3), une édition
 * `CREATION_NOUVEAU_TOURNOI` peut coexister avec l'édition sortante
 * `TOURNOI_DEMARRE` : elle est exclue de `getEditionActive()` (donc
 * invisible de tout l'affichage public / `edition/courante`) et résolue
 * séparément par `getEditionEnPreparation()`, réservée à l'organisateur.
 */
@Injectable()
export class EditionResolverService {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async getEditionActive(): Promise<InscEditionAvecAnneesAge> {
    const edition = await this.prisma.inscEdition.findFirst({
      where: { etape: { not: 'CREATION_NOUVEAU_TOURNOI' } },
      orderBy: { createdAt: 'desc' },
      include: { anneesAge: true },
    });
    if (!edition) {
      throw new NotFoundException('Aucune édition trouvée');
    }
    return edition;
  }

  async getEditionEnPreparation(): Promise<InscEditionAvecAnneesAge | null> {
    return this.prisma.inscEdition.findFirst({
      where: { etape: 'CREATION_NOUVEAU_TOURNOI' },
      orderBy: { createdAt: 'desc' },
      include: { anneesAge: true },
    });
  }
}
