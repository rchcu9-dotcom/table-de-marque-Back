import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import type { EditionEtape } from '../../domain/enums/edition-etape.enum';
import {
  formuleSportiveModifiable,
  MESSAGE_FORMULE_FIGEE,
  MESSAGE_INSCRIPTION_FIGEE,
  parametresInscriptionModifiables,
} from '../../domain/edition-regles';

/**
 * Gardes d'écriture par étape, appelées en première ligne des use cases de
 * mise à jour (inscription et planning) : 404 si l'édition n'existe pas, 409
 * si son étape interdit la modification.
 */
@Injectable()
export class EditionVerrouService {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async assertParametresInscriptionModifiables(
    editionId: number,
  ): Promise<void> {
    const etape = await this.lireEtape(editionId);
    if (!parametresInscriptionModifiables(etape)) {
      throw new ConflictException(MESSAGE_INSCRIPTION_FIGEE);
    }
  }

  async assertFormuleSportiveModifiable(editionId: number): Promise<void> {
    const etape = await this.lireEtape(editionId);
    if (!formuleSportiveModifiable(etape)) {
      throw new ConflictException(MESSAGE_FORMULE_FIGEE);
    }
  }

  private async lireEtape(editionId: number): Promise<EditionEtape> {
    const edition = await this.prisma.inscEdition.findUnique({
      where: { id: editionId },
      select: { etape: true },
    });
    if (!edition) {
      throw new NotFoundException(`Édition ${editionId} introuvable`);
    }
    return edition.etape as EditionEtape;
  }
}
