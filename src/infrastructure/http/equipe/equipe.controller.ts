import { Controller, Get, Param } from '@nestjs/common';
import { GetAllEquipesUseCase } from '@/application/equipe/use-cases/get-all-equipes.usecase';
import { GetEquipeByIdUseCase } from '@/application/equipe/use-cases/get-equipe-by-id.usecase';
import { CacheSnapshotService } from '@/infrastructure/cache/cache.snapshot.service';

@Controller('equipes')
export class EquipeController {
  constructor(
    private readonly getAllEquipes: GetAllEquipesUseCase,
    private readonly getEquipeById: GetEquipeByIdUseCase,
    private readonly cache: CacheSnapshotService,
  ) {}

  @Get()
  async list() {
    return this.cache.staleWhileRevalidate('equipes', () =>
      this.getAllEquipes.execute(),
    );
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.getEquipeById.execute(id);
  }
}
