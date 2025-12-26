import { Inject, Injectable } from '@nestjs/common';
import { Atelier } from '@/domain/challenge/entities/atelier.entity';
import { ATELIER_REPOSITORY, AtelierRepository } from '@/domain/challenge/repositories/atelier.repository';

@Injectable()
export class GetAteliersUseCase {
  constructor(
    @Inject(ATELIER_REPOSITORY)
    private readonly repo: AtelierRepository,
  ) {}

  async execute(): Promise<Atelier[]> {
    return this.repo.findAll();
  }
}
