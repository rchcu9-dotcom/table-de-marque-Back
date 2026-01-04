import { TentativeAtelier } from '../entities/tentative-atelier.entity';

export const TENTATIVE_ATELIER_REPOSITORY = Symbol(
  'TENTATIVE_ATELIER_REPOSITORY',
);

export abstract class TentativeAtelierRepository {
  abstract create(tentative: TentativeAtelier): Promise<TentativeAtelier>;
  abstract findByAtelier(atelierId: string): Promise<TentativeAtelier[]>;
  abstract findAll(): Promise<TentativeAtelier[]>;
  abstract clear(): Promise<void>;
}
