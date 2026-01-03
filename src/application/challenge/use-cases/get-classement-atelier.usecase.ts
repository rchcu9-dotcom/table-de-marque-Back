import { Inject, Injectable } from '@nestjs/common';
import {
  ATELIER_REPOSITORY,
  AtelierRepository,
} from '@/domain/challenge/repositories/atelier.repository';
import {
  TENTATIVE_ATELIER_REPOSITORY,
  TentativeAtelierRepository,
} from '@/domain/challenge/repositories/tentative-atelier.repository';
import {
  ClassementService,
  ClassementEntry,
} from '@/domain/challenge/services/classement.service';

@Injectable()
export class GetClassementAtelierUseCase {
  constructor(
    @Inject(ATELIER_REPOSITORY)
    private readonly ateliers: AtelierRepository,
    @Inject(TENTATIVE_ATELIER_REPOSITORY)
    private readonly tentatives: TentativeAtelierRepository,
    private readonly classementService: ClassementService,
  ) {}

  async execute(atelierId: string): Promise<ClassementEntry[]> {
    const atelier = await this.ateliers.findById(atelierId);
    if (!atelier) {
      throw new Error('Atelier not found');
    }
    const data = await this.tentatives.findByAtelier(atelierId);
    return this.classementService.compute(atelier, data);
  }
}
