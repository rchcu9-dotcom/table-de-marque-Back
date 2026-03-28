import { Partenaire } from '../entities/partenaire.entity';

export const PARTENAIRE_REPOSITORY = 'PARTENAIRE_REPOSITORY';

export interface PartenaireRepository {
  findAllActifs(): Promise<Partenaire[]>;
}
