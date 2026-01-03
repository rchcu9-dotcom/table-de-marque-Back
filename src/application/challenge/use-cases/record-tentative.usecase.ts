import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ATELIER_REPOSITORY,
  AtelierRepository,
} from '@/domain/challenge/repositories/atelier.repository';
import {
  TENTATIVE_ATELIER_REPOSITORY,
  TentativeAtelierRepository,
} from '@/domain/challenge/repositories/tentative-atelier.repository';
import {
  TentativeAtelier,
  TentativeMetrics,
} from '@/domain/challenge/entities/tentative-atelier.entity';

@Injectable()
export class RecordTentativeUseCase {
  constructor(
    @Inject(ATELIER_REPOSITORY)
    private readonly ateliers: AtelierRepository,
    @Inject(TENTATIVE_ATELIER_REPOSITORY)
    private readonly tentatives: TentativeAtelierRepository,
  ) {}

  async execute(params: {
    atelierId: string;
    joueurId: string;
    metrics: TentativeMetrics;
  }): Promise<TentativeAtelier> {
    const atelier = await this.ateliers.findById(params.atelierId);
    if (!atelier) {
      throw new Error('Atelier not found');
    }

    // Validation simple sur le type
    if (atelier.type !== params.metrics.type) {
      throw new Error(
        `Metrics type ${params.metrics.type} does not match atelier type ${atelier.type}`,
      );
    }

    const tentative = new TentativeAtelier(
      randomUUID(),
      atelier.id,
      params.joueurId,
      atelier.type,
      params.metrics,
      new Date(),
    );

    return this.tentatives.create(tentative);
  }
}
