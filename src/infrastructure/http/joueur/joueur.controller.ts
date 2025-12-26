import { Controller, Get, Param, Query } from '@nestjs/common';

import { GetAllJoueursUseCase } from '@/application/joueur/use-cases/get-all-joueurs.usecase';
import { GetJoueurByIdUseCase } from '@/application/joueur/use-cases/get-joueur-by-id.usecase';
import { GetJoueursByEquipeUseCase } from '@/application/joueur/use-cases/get-joueurs-by-equipe.usecase';

@Controller('joueurs')
export class JoueurController {
  constructor(
    private readonly getAll: GetAllJoueursUseCase,
    private readonly getById: GetJoueurByIdUseCase,
    private readonly getByEquipe: GetJoueursByEquipeUseCase,
  ) {}

  @Get()
  async list(@Query('equipe') equipeId?: string) {
    if (equipeId) {
      return this.getByEquipe.execute(equipeId);
    }
    return this.getAll.execute();
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.getById.execute(id);
  }
}
