import { Atelier } from '../entities/atelier.entity';

export const ATELIER_REPOSITORY = Symbol('ATELIER_REPOSITORY');

export abstract class AtelierRepository {
  abstract findAll(): Promise<Atelier[]>;
  abstract findById(id: string): Promise<Atelier | null>;
  abstract seed(ateliers: Atelier[]): Promise<void>;
}
