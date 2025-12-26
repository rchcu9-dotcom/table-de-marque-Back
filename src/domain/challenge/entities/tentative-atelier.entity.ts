import { AtelierType } from './atelier.entity';

export type TentativeMetrics =
  | { type: 'vitesse'; tempsMs: number }
  | { type: 'tir'; tirs: number[]; totalPoints: number }
  | { type: 'glisse_crosse'; tempsMs: number; penalites: number };

export class TentativeAtelier {
  constructor(
    public id: string,
    public atelierId: string,
    public joueurId: string,
    public type: AtelierType,
    public metrics: TentativeMetrics,
    public createdAt: Date,
  ) {}
}
