import { CreneauActivite } from '../entities/creneau-activite.entity';

export const CRENEAU_ACTIVITE_REPOSITORY = Symbol(
  'CRENEAU_ACTIVITE_REPOSITORY',
);

export type CreneauActiviteData = {
  activiteId: number;
  date: Date;
  heureDebut: Date;
  dureeMin: number;
};

export type CreneauAssignation = {
  creneauId: number;
  equipeId: number | null;
  equipeLabel: string | null;
};

export abstract class CreneauActiviteRepository {
  abstract findByEdition(editionId: number): Promise<CreneauActivite[]>;
  abstract findLibresByEdition(editionId: number): Promise<CreneauActivite[]>;
  abstract findConfirmesByEdition(
    editionId: number,
  ): Promise<CreneauActivite[]>;
  abstract create(
    editionId: number,
    data: CreneauActiviteData,
  ): Promise<CreneauActivite>;
  abstract update(
    id: number,
    editionId: number,
    data: CreneauActiviteData,
  ): Promise<CreneauActivite>;
  abstract delete(id: number, editionId: number): Promise<void>;
  /**
   * Remplace `createConfirmees()` (l'ancien moteur créait les lignes à la
   * confirmation) : les créneaux existent déjà (saisis par l'admin), la
   * confirmation ne fait qu'assigner equipeId/equipeLabel et passer le
   * statut à CONFIRME sur les lignes existantes.
   */
  abstract assignerEquipes(
    editionId: number,
    assignations: CreneauAssignation[],
  ): Promise<CreneauActivite[]>;
}
