import { TentativeAtelier } from '../entities/tentative-atelier.entity';

export const TENTATIVE_ATELIER_REPOSITORY = Symbol(
  'TENTATIVE_ATELIER_REPOSITORY',
);

export abstract class TentativeAtelierRepository {
  abstract create(tentative: TentativeAtelier): Promise<TentativeAtelier>;
  abstract findByAtelier(atelierId: string): Promise<TentativeAtelier[]>;
  abstract findAll(): Promise<TentativeAtelier[]>;
  abstract clear(): Promise<void>;

  async findAllGrouped(): Promise<Map<string, TentativeAtelier[]>> {
    const all = await this.findAll();
    const grouped = new Map<string, TentativeAtelier[]>();
    for (const t of all) {
      const bucket = grouped.get(t.atelierId);
      if (bucket) bucket.push(t);
      else grouped.set(t.atelierId, [t]);
    }
    return grouped;
  }
}
