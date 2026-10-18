import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { Edition } from '../../domain/entities/edition.entity';
import { EditionEtape } from '../../domain/enums/edition-etape.enum';
import { estTransitionAutorisee } from '../../domain/edition-transitions';
import { toEditionEntity } from '../../infrastructure/persistence/edition.mapper';

export type CibleEtape =
  | 'INSCRIPTIONS_OUVERTES'
  | 'CLOTUREE'
  | 'CREEE'
  | 'CREATION_NOUVEAU_TOURNOI';

/**
 * Logique commune des transitions d'étape pilotées depuis l'accueil admin
 * (ouvrir, clôturer, revenir en préparation). TOURNOI_DEMARRE reste servi par
 * DemarrerTournoiUseCase.
 */
@Injectable()
export class ChangerEtapeEditionService {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(id: number, cible: CibleEtape): Promise<Edition> {
    const existing = await this.prisma.inscEdition.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Édition ${id} introuvable`);
    }

    const depart = existing.etape as EditionEtape;
    const message = `Transition d'étape interdite : ${depart} → ${cible}`;
    if (!estTransitionAutorisee(depart, cible)) {
      throw new ConflictException(message);
    }

    // Mise à jour conditionnelle sur l'état lu : évite qu'un double clic ou
    // deux organisateurs simultanés n'écrasent un état intermédiaire.
    const { count } = await this.prisma.inscEdition.updateMany({
      where: { id, etape: depart },
      data: { etape: cible },
    });
    if (count === 0) {
      throw new ConflictException(message);
    }

    const updated = await this.prisma.inscEdition.findUniqueOrThrow({
      where: { id },
      include: { anneesAge: true },
    });
    return toEditionEntity(updated);
  }
}
