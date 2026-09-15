import { InscEditionJour } from '../entities/inscription-edition-jour.entity';

export const INSCRIPTION_EDITION_JOUR_REPOSITORY = Symbol(
  'INSCRIPTION_EDITION_JOUR_REPOSITORY',
);

export abstract class InscriptionEditionJourRepository {
  abstract findByEdition(editionId: number): Promise<InscEditionJour[]>;
  abstract upsert(
    editionId: number,
    numeroJour: number,
    data: {
      date: Date;
      heureDebut: Date;
      heureFin: Date;
      typeJournee: string;
    },
  ): Promise<InscEditionJour>;
  abstract delete(editionId: number, numeroJour: number): Promise<void>;
}
