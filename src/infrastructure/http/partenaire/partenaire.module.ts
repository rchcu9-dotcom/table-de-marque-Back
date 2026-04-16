import { Module } from '@nestjs/common';
import { PartenaireController } from './partenaire.controller';
import { PersistenceModule } from '@/infrastructure/persistence/persistence.module';
import { GetAllPartenairesUseCase } from '@/application/partenaire/use-cases/get-all-partenaires.usecase';

@Module({
  imports: [PersistenceModule],
  controllers: [PartenaireController],
  providers: [GetAllPartenairesUseCase],
})
export class PartenaireModule {}
