import { ActiviteCatalogue } from '../entities/activite-catalogue.entity';

export const ACTIVITE_CATALOGUE_REPOSITORY = Symbol(
  'ACTIVITE_CATALOGUE_REPOSITORY',
);

export type ActiviteCatalogueData = {
  label: string;
  dureeParEquipeMin: number;
  capaciteParallele: number;
};

export abstract class ActiviteCatalogueRepository {
  abstract findByEdition(editionId: number): Promise<ActiviteCatalogue[]>;
  abstract create(
    editionId: number,
    data: ActiviteCatalogueData,
  ): Promise<ActiviteCatalogue>;
  abstract update(
    id: number,
    editionId: number,
    data: ActiviteCatalogueData,
  ): Promise<ActiviteCatalogue>;
  abstract delete(id: number, editionId: number): Promise<void>;
}
