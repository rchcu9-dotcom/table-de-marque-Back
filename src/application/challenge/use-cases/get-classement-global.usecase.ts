import { Inject, Injectable } from '@nestjs/common';
import {
  ATELIER_REPOSITORY,
  AtelierRepository,
} from '@/domain/challenge/repositories/atelier.repository';
import {
  TENTATIVE_ATELIER_REPOSITORY,
  TentativeAtelierRepository,
} from '@/domain/challenge/repositories/tentative-atelier.repository';
import { ClassementService } from '@/domain/challenge/services/classement.service';

export type ClassementGlobalEntry = {
  joueurId: string;
  totalRang: number;
  details: { atelierId: string; rang: number }[];
};

@Injectable()
export class GetClassementGlobalUseCase {
  constructor(
    @Inject(ATELIER_REPOSITORY)
    private readonly ateliers: AtelierRepository,
    @Inject(TENTATIVE_ATELIER_REPOSITORY)
    private readonly tentatives: TentativeAtelierRepository,
    private readonly classementService: ClassementService,
  ) {}

  async execute(): Promise<ClassementGlobalEntry[]> {
    const ateliers = await this.ateliers.findAll();
    const perAtelier = await Promise.all(
      ateliers.map(async (atelier) => {
        const data = await this.tentatives.findByAtelier(atelier.id);
        const classement = this.classementService.compute(atelier, data);
        return { atelierId: atelier.id, classement };
      }),
    );

    const aggregator = new Map<string, ClassementGlobalEntry>();
    perAtelier.forEach(({ atelierId, classement }) => {
      classement.forEach((entry) => {
        const current = aggregator.get(entry.joueurId) ?? {
          joueurId: entry.joueurId,
          totalRang: 0,
          details: [],
        };
        current.totalRang += entry.ordre;
        current.details.push({ atelierId, rang: entry.ordre });
        aggregator.set(entry.joueurId, current);
      });
    });

    return Array.from(aggregator.values()).sort(
      (a, b) => a.totalRang - b.totalRang,
    );
  }
}
