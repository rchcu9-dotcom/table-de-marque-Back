import { Inject, Injectable } from '@nestjs/common';
import {
  CreneauActiviteRepository,
  CRENEAU_ACTIVITE_REPOSITORY,
} from '../../../domain/repositories/creneau-activite.repository';
import { CreneauActivite } from '../../../domain/entities/creneau-activite.entity';
import { UpsertCreneauActiviteDto } from '../../dto/upsert-creneau-activite.dto';
import { EditionVerrouService } from '@/inscription/application/shared/edition-verrou.service';

@Injectable()
export class CreerCreneauActiviteUseCase {
  constructor(
    @Inject(CRENEAU_ACTIVITE_REPOSITORY)
    private readonly repository: CreneauActiviteRepository,
    private readonly editionVerrou: EditionVerrouService,
  ) {}

  async execute(
    editionId: number,
    dto: UpsertCreneauActiviteDto,
  ): Promise<CreneauActivite> {
    // Formule sportive figée au lancement du tournoi (404 si l'édition n'existe pas).
    await this.editionVerrou.assertFormuleSportiveModifiable(editionId);
    return this.repository.create(editionId, {
      activiteId: dto.activiteId,
      date: new Date(dto.date),
      heureDebut: new Date(dto.heureDebut),
      dureeMin: dto.dureeMin,
    });
  }
}
