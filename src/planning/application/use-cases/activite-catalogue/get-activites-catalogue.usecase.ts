import { Inject, Injectable } from '@nestjs/common';
import {
  ActiviteCatalogueRepository,
  ACTIVITE_CATALOGUE_REPOSITORY,
} from '../../../domain/repositories/activite-catalogue.repository';
import { ActiviteCatalogue } from '../../../domain/entities/activite-catalogue.entity';
import {
  DEFAULT_CAPACITE_PARALLELE_CHALLENGE,
  DEFAULT_CAPACITE_PARALLELE_REPAS,
  DEFAULT_DUREE_CHALLENGE_MIN,
  DEFAULT_DUREE_REPAS_MIN,
} from '../../services/default-parametres';

/**
 * Le catalogue d'Activités remplace l'enum figé PlanningActiviteType — pour
 * qu'une édition dispose de Repas/Challenge dès son premier chargement (§3
 * de la spec) sans étape de bootstrap dédiée à déclencher côté front, ce
 * use-case seed ces deux lignes de façon persistante au premier GET, si le
 * catalogue de l'édition est vide.
 */
@Injectable()
export class GetActivitesCatalogueUseCase {
  constructor(
    @Inject(ACTIVITE_CATALOGUE_REPOSITORY)
    private readonly repository: ActiviteCatalogueRepository,
  ) {}

  async execute(editionId: number): Promise<ActiviteCatalogue[]> {
    const existantes = await this.repository.findByEdition(editionId);
    if (existantes.length > 0) return existantes;

    const repas = await this.repository.create(editionId, {
      label: 'Repas',
      dureeParEquipeMin: DEFAULT_DUREE_REPAS_MIN,
      capaciteParallele: DEFAULT_CAPACITE_PARALLELE_REPAS,
    });
    const challenge = await this.repository.create(editionId, {
      label: 'Challenge',
      dureeParEquipeMin: DEFAULT_DUREE_CHALLENGE_MIN,
      capaciteParallele: DEFAULT_CAPACITE_PARALLELE_CHALLENGE,
    });
    return [repas, challenge];
  }
}
