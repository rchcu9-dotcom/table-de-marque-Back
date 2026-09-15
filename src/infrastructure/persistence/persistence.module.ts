import { Module } from '@nestjs/common';

import {
  MATCH_REPOSITORY,
  MATCH_REPOSITORY_SOURCE,
} from '@/domain/match/repositories/match.repository';
import {
  EQUIPE_REPOSITORY,
  EQUIPE_REPOSITORY_LEGACY,
  EquipeRepository,
} from '@/domain/equipe/repositories/equipe.repository';
import { ClassementPouleEngine } from '@/domain/equipe/services/classement-poule.engine';
import { MEAL_REPOSITORY } from '@/domain/meal/repositories/meal.repository';
import { JOUEUR_REPOSITORY } from '@/domain/joueur/repositories/joueur.repository';
import { ATELIER_REPOSITORY } from '@/domain/challenge/repositories/atelier.repository';
import { TENTATIVE_ATELIER_REPOSITORY } from '@/domain/challenge/repositories/tentative-atelier.repository';
import { CHALLENGE_VITESSE_J3_REPOSITORY } from '@/domain/challenge/repositories/challenge-vitesse-j3.repository';
import { CHALLENGE_GARDIEN_J3_REPOSITORY } from '@/domain/challenge/repositories/challenge-gardien-j3.repository';
import { CHALLENGE_J1_MOMENTUM_REPOSITORY } from '@/domain/challenge/repositories/challenge-j1-momentum.repository';
import { InMemoryMatchRepository } from './memory/in-memory-match.repository';
import { GoogleSheetsMatchRepository } from './google-sheets/google-sheets-match.repository';
import { GoogleSheetsPublicCsvMatchRepository } from './google-sheets/google-sheets-public-csv.repository';
import { GoogleSheetsPublicCsvEquipeRepository } from './google-sheets/google-sheets-public-csv-equipe.repository';
import { InMemoryEquipeRepository } from './memory/in-memory-equipe.repository';
import { InMemoryJoueurRepository } from './memory/in-memory-joueur.repository';
import { InMemoryMealRepository } from './memory/in-memory-meal.repository';
import { InMemoryAtelierRepository } from './memory/in-memory-atelier.repository';
import { InMemoryTentativeAtelierRepository } from './memory/in-memory-tentative-atelier.repository';
import { InMemoryChallengeVitesseJ3Repository } from './memory/in-memory-challenge-vitesse-j3.repository';
import { InMemoryChallengeGardienJ3Repository } from './memory/in-memory-challenge-gardien-j3.repository';
import { InMemoryChallengeJ1MomentumRepository } from './memory/in-memory-challenge-j1-momentum.repository';
import { MatchCacheService } from './match-cache.service';
import { MatchPollingService } from '@/hooks/match-polling.service';
import { MatchStreamService } from '@/hooks/match-stream.service';
import { PrismaService } from './mysql/prisma.service';
import { MySqlMatchRepository } from './mysql/mysql-match.repository';
import { MatchEnrichmentService } from './mysql/match-enrichment.service';
import { MySqlEquipeRepository } from './mysql/mysql-equipe.repository';
import { ClassementInterneEquipeRepository } from './mysql/classement-interne-equipe.repository';
import { MySqlJoueurRepository } from './mysql/mysql-joueur.repository';
import { MySqlMealRepository } from './mysql/mysql-meal.repository';
import { MySqlAtelierRepository } from './mysql/mysql-atelier.repository';
import { MySqlTentativeAtelierRepository } from './mysql/mysql-tentative-atelier.repository';
import { MySqlChallengeVitesseJ3Repository } from './mysql/mysql-challenge-vitesse-j3.repository';
import { MySqlChallengeGardienJ3Repository } from './mysql/mysql-challenge-gardien-j3.repository';
import { MySqlChallengeJ1MomentumRepository } from './mysql/mysql-challenge-j1-momentum.repository';
import { MySqlPartenaireRepository } from './mysql/mysql-partenaire.repository';
import { PARTENAIRE_REPOSITORY } from '@/domain/partenaire/repositories/partenaire.repository';
import { PRESENTATION_REPOSITORY } from '@/domain/presentation/repositories/presentation.repository';
import { PRESENTATION_ARTICLE_REPOSITORY } from '@/domain/presentation/repositories/presentation-article.repository';
import { GoogleSheetsPresentationRepository } from './google-sheets/google-sheets-presentation.repository';
import { InMemoryPresentationRepository } from './memory/in-memory-presentation.repository';
import { MySqlPresentationRepository } from './mysql/mysql-presentation.repository';
import { MySqlPresentationArticleRepository } from './mysql/mysql-presentation-article.repository';

type MatchRepoDriver =
  | 'google-sheets-public'
  | 'google-sheets'
  | 'memory'
  | 'prisma';

const baseMatchRepositoryProvider = {
  provide: MATCH_REPOSITORY_SOURCE,
  useFactory: (prisma: PrismaService, enrichment: MatchEnrichmentService) => {
    const raw = (process.env.MATCH_REPOSITORY_DRIVER ?? '')
      .trim()
      .toLowerCase();
    const driver: MatchRepoDriver =
      (raw as MatchRepoDriver) ||
      (process.env.GOOGLE_SHEETS_CSV_URL ? 'google-sheets-public' : 'memory');

    switch (driver) {
      case 'google-sheets-public':
        return new GoogleSheetsPublicCsvMatchRepository();
      case 'google-sheets':
        return new GoogleSheetsMatchRepository();
      case 'prisma':
        return new MySqlMatchRepository(prisma, enrichment);
      case 'memory':
        return new InMemoryMatchRepository();
      default:
        return new InMemoryMatchRepository();
    }
  },
  inject: [PrismaService, MatchEnrichmentService],
};

const cachedMatchRepositoryProvider = {
  provide: MATCH_REPOSITORY,
  useExisting: MatchCacheService,
};

const equipeLegacyPersistenceProvider = {
  provide: EQUIPE_REPOSITORY_LEGACY,
  useFactory: (prisma: PrismaService) => {
    const driver =
      (process.env.EQUIPE_REPOSITORY_DRIVER ?? '').trim().toLowerCase() ||
      'google-sheets-public';

    if (driver === 'google-sheets-public') {
      return new GoogleSheetsPublicCsvEquipeRepository();
    }

    if (driver === 'memory') {
      return new InMemoryEquipeRepository();
    }

    if (driver === 'prisma') {
      return new MySqlEquipeRepository(prisma);
    }

    throw new Error(`Unsupported EQUIPE_REPOSITORY_DRIVER: ${driver}`);
  },
  inject: [PrismaService],
};

/**
 * Décorateur branché sur EQUIPE_REPOSITORY (chantier "classement live" —
 * docs/specs/chantier-suivant-implementer-le-classement-live-doit-etre-ca.md) :
 * calcule le classement sportif en interne depuis TA_MATCHS/MatchLive pour
 * les poules de brassage/qualification round-robin, et délègue à
 * EQUIPE_REPOSITORY_LEGACY (ta_classement/CSV, selon EQUIPE_REPOSITORY_DRIVER)
 * pour les champs non sportifs et les pouleCode hors périmètre (J3, challenge).
 */
const equipePersistenceProvider = {
  provide: EQUIPE_REPOSITORY,
  useFactory: (
    prisma: PrismaService,
    enrichment: MatchEnrichmentService,
    engine: ClassementPouleEngine,
    legacy: EquipeRepository,
  ) =>
    new ClassementInterneEquipeRepository(prisma, enrichment, engine, legacy),
  inject: [
    PrismaService,
    MatchEnrichmentService,
    ClassementPouleEngine,
    EQUIPE_REPOSITORY_LEGACY,
  ],
};

const mealPersistenceProvider = {
  provide: MEAL_REPOSITORY,
  useFactory: (prisma: PrismaService) => {
    const driver =
      (process.env.MEALS_REPOSITORY_DRIVER ??
        process.env.EQUIPE_REPOSITORY_DRIVER ??
        '')
        .trim()
        .toLowerCase() || 'memory';
    if (driver === 'prisma') {
      return new MySqlMealRepository(prisma);
    }
    return new InMemoryMealRepository();
  },
  inject: [PrismaService],
};

const joueurPersistenceProvider = {
  provide: JOUEUR_REPOSITORY,
  useFactory: (prisma: PrismaService) => {
    const driver =
      (process.env.JOUEUR_REPOSITORY_DRIVER ?? '').trim().toLowerCase() ||
      'memory';
    if (driver === 'prisma') {
      return new MySqlJoueurRepository(prisma);
    }
    return new InMemoryJoueurRepository();
  },
  inject: [PrismaService],
};

const atelierPersistenceProvider = {
  provide: ATELIER_REPOSITORY,
  useFactory: () => {
    const driver =
      (process.env.ATELIER_REPOSITORY_DRIVER ?? '').trim().toLowerCase() ||
      'memory';
    if (driver === 'prisma') {
      return new MySqlAtelierRepository();
    }
    return new InMemoryAtelierRepository();
  },
};

const tentativeAtelierPersistenceProvider = {
  provide: TENTATIVE_ATELIER_REPOSITORY,
  useFactory: (prisma: PrismaService) => {
    const driver =
      (process.env.TENTATIVE_ATELIER_REPOSITORY_DRIVER ?? '')
        .trim()
        .toLowerCase() || 'memory';
    if (driver === 'prisma') {
      return new MySqlTentativeAtelierRepository(prisma);
    }
    return new InMemoryTentativeAtelierRepository();
  },
  inject: [PrismaService],
};

const challengeVitesseJ3PersistenceProvider = {
  provide: CHALLENGE_VITESSE_J3_REPOSITORY,
  useFactory: (prisma: PrismaService) => {
    const driver =
      (process.env.CHALLENGE_VITESSE_J3_REPOSITORY_DRIVER ??
        process.env.JOUEUR_REPOSITORY_DRIVER ??
        '')
        .trim()
        .toLowerCase() || 'memory';
    if (driver === 'prisma') {
      return new MySqlChallengeVitesseJ3Repository(prisma);
    }
    return new InMemoryChallengeVitesseJ3Repository();
  },
  inject: [PrismaService],
};

const challengeGardienJ3PersistenceProvider = {
  provide: CHALLENGE_GARDIEN_J3_REPOSITORY,
  useFactory: (prisma: PrismaService) => {
    const driver =
      (process.env.CHALLENGE_GARDIEN_J3_REPOSITORY_DRIVER ??
        process.env.JOUEUR_REPOSITORY_DRIVER ??
        '')
        .trim()
        .toLowerCase() || 'memory';
    if (driver === 'prisma') {
      return new MySqlChallengeGardienJ3Repository(prisma);
    }
    return new InMemoryChallengeGardienJ3Repository();
  },
  inject: [PrismaService],
};

const partenairePersistenceProvider = {
  provide: PARTENAIRE_REPOSITORY,
  useFactory: (prisma: PrismaService) => new MySqlPartenaireRepository(prisma),
  inject: [PrismaService],
};

const presentationArticlePersistenceProvider = {
  provide: PRESENTATION_ARTICLE_REPOSITORY,
  useFactory: (prisma: PrismaService) => new MySqlPresentationArticleRepository(prisma),
  inject: [PrismaService],
};

// Le contenu de présentation (accueil pendant INSCRIPTIONS_OUVERTES) est géré par
// l'organisateur via la GUI admin (/admin/presentation-tournoi, table
// presentation_articles) depuis la spec de découplage du Google Sheet — 'db' est donc
// le driver par défaut. 'google-sheets-public' et 'memory' restent disponibles via
// PRESENTATION_REPOSITORY_DRIVER pour rollback/tests, mais ne sont plus l'auto-détection
// par défaut (l'ancienne détection sur GOOGLE_SHEETS_PRESENTATION_CSV_URL est retirée :
// cette variable n'a plus vocation à être positionnée).
const presentationPersistenceProvider = {
  provide: PRESENTATION_REPOSITORY,
  useFactory: (
    prisma: PrismaService,
    articleRepo: MySqlPresentationArticleRepository,
  ) => {
    const driver =
      (process.env.PRESENTATION_REPOSITORY_DRIVER ?? '').trim().toLowerCase() ||
      'db';
    if (driver === 'google-sheets-public') {
      return new GoogleSheetsPresentationRepository();
    }
    if (driver === 'memory') {
      return new InMemoryPresentationRepository();
    }
    return new MySqlPresentationRepository(articleRepo);
  },
  inject: [PrismaService, PRESENTATION_ARTICLE_REPOSITORY],
};

const challengeJ1MomentumPersistenceProvider = {
  provide: CHALLENGE_J1_MOMENTUM_REPOSITORY,
  useFactory: (prisma: PrismaService) => {
    const driver =
      (process.env.CHALLENGE_J1_MOMENTUM_REPOSITORY_DRIVER ??
        process.env.JOUEUR_REPOSITORY_DRIVER ??
        '')
        .trim()
        .toLowerCase() || 'memory';
    if (driver === 'prisma') {
      return new MySqlChallengeJ1MomentumRepository(prisma);
    }
    return new InMemoryChallengeJ1MomentumRepository();
  },
  inject: [PrismaService],
};

@Module({
  providers: [
    PrismaService,
    MatchEnrichmentService,
    baseMatchRepositoryProvider,
    MatchStreamService,
    MatchCacheService,
    cachedMatchRepositoryProvider,
    MatchPollingService,
    ClassementPouleEngine,
    equipeLegacyPersistenceProvider,
    equipePersistenceProvider,
    mealPersistenceProvider,
    joueurPersistenceProvider,
    atelierPersistenceProvider,
    tentativeAtelierPersistenceProvider,
    challengeVitesseJ3PersistenceProvider,
    challengeGardienJ3PersistenceProvider,
    challengeJ1MomentumPersistenceProvider,
    partenairePersistenceProvider,
    presentationArticlePersistenceProvider,
    presentationPersistenceProvider,
  ],
  exports: [
    PrismaService,
    MATCH_REPOSITORY,
    EQUIPE_REPOSITORY,
    MEAL_REPOSITORY,
    JOUEUR_REPOSITORY,
    ATELIER_REPOSITORY,
    TENTATIVE_ATELIER_REPOSITORY,
    CHALLENGE_VITESSE_J3_REPOSITORY,
    CHALLENGE_GARDIEN_J3_REPOSITORY,
    CHALLENGE_J1_MOMENTUM_REPOSITORY,
    PARTENAIRE_REPOSITORY,
    PRESENTATION_REPOSITORY,
    PRESENTATION_ARTICLE_REPOSITORY,
    MatchStreamService,
  ],
})
export class PersistenceModule {}
