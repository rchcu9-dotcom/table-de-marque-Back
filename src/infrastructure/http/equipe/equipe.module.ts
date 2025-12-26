import { Module } from '@nestjs/common';
import { EquipeController } from './equipe.controller';
import { PersistenceModule } from '@/infrastructure/persistence/persistence.module';
import { GetAllEquipesUseCase } from '@/application/equipe/use-cases/get-all-equipes.usecase';
import { GetEquipeByIdUseCase } from '@/application/equipe/use-cases/get-equipe-by-id.usecase';

@Module({
  imports: [PersistenceModule],
  controllers: [EquipeController],
  providers: [GetAllEquipesUseCase, GetEquipeByIdUseCase],
})
export class EquipeModule {}
