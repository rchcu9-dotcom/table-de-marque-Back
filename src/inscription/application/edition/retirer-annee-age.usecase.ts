import { Injectable } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { EditionVerrouService } from '../shared/edition-verrou.service';
import { Edition } from '../../domain/entities/edition.entity';
import { toEditionEntity } from '../../infrastructure/persistence/edition.mapper';

@Injectable()
export class RetirerAnneeAgeUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly editionVerrou: EditionVerrouService,
  ) {}

  async execute(editionId: number, annee: number): Promise<Edition> {
    // Figés dès l'ouverture des inscriptions (404 si l'édition n'existe pas).
    await this.editionVerrou.assertParametresInscriptionModifiables(editionId);

    // Pas de garde-fou si des dossiers joueurs référencent déjà cette année :
    // même tolérance que celle actée pour les postes hors énumération (spec
    // "Dossiers historiques") — seule la saisie future est contrainte.
    await this.prisma.inscEditionAnneeAge.deleteMany({
      where: { editionId, annee },
    });

    const edition = await this.prisma.inscEdition.findUniqueOrThrow({
      where: { id: editionId },
      include: { anneesAge: true },
    });

    return toEditionEntity(edition);
  }
}
