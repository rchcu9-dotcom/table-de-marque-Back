import { Module } from '@nestjs/common';

import { PersistenceModule } from '@/infrastructure/persistence/persistence.module';
import { JoueurController } from './joueur.controller';
import { GetAllJoueursUseCase } from '@/application/joueur/use-cases/get-all-joueurs.usecase';
import { GetJoueurByIdUseCase } from '@/application/joueur/use-cases/get-joueur-by-id.usecase';
import { GetJoueursByEquipeUseCase } from '@/application/joueur/use-cases/get-joueurs-by-equipe.usecase';

@Module({
  imports: [PersistenceModule],
  controllers: [JoueurController],
  providers: [GetAllJoueursUseCase, GetJoueurByIdUseCase, GetJoueursByEquipeUseCase],
})
export class JoueurModule {}
