import { Module } from '@nestjs/common';

import { PersistenceModule } from '@/infrastructure/persistence/persistence.module';
import { CacheModule } from '@/infrastructure/cache/cache.module';
import { PresentationController } from './presentation.controller';
import { GetPresentationUseCase } from '@/application/presentation/use-cases/get-presentation.usecase';
import { ListPresentationArticlesUseCase } from '@/application/presentation/use-cases/list-presentation-articles.usecase';
import { CreerPresentationArticleUseCase } from '@/application/presentation/use-cases/creer-presentation-article.usecase';
import { ModifierPresentationArticleUseCase } from '@/application/presentation/use-cases/modifier-presentation-article.usecase';
import { SupprimerPresentationArticleUseCase } from '@/application/presentation/use-cases/supprimer-presentation-article.usecase';
import { ModifierPresentationGroupeUseCase } from '@/application/presentation/use-cases/modifier-presentation-groupe.usecase';
import { DeplacerPresentationGroupeUseCase } from '@/application/presentation/use-cases/deplacer-presentation-groupe.usecase';
import { DeplacerPresentationArticleUseCase } from '@/application/presentation/use-cases/deplacer-presentation-article.usecase';
import { SupprimerPresentationGroupeUseCase } from '@/application/presentation/use-cases/supprimer-presentation-groupe.usecase';
import { DriveImageProxyService } from './drive-image-proxy.service';

@Module({
  imports: [PersistenceModule, CacheModule],
  controllers: [PresentationController],
  providers: [
    DriveImageProxyService,
    GetPresentationUseCase,
    ListPresentationArticlesUseCase,
    CreerPresentationArticleUseCase,
    ModifierPresentationArticleUseCase,
    SupprimerPresentationArticleUseCase,
    ModifierPresentationGroupeUseCase,
    DeplacerPresentationGroupeUseCase,
    DeplacerPresentationArticleUseCase,
    SupprimerPresentationGroupeUseCase,
  ],
})
export class PresentationModule {}
