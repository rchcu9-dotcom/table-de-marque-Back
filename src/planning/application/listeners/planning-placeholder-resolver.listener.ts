import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MatchStreamService } from '@/hooks/match-stream.service';
import { EditionResolverService } from '@/inscription/application/shared/edition-resolver.service';
import {
  EQUIPE_REPOSITORY,
  EquipeRepository,
} from '@/domain/equipe/repositories/equipe.repository';
import {
  PLANNING_MATCH_WRITER,
  PlanningMatchWriter,
} from '../../domain/repositories/planning-match-writer.repository';
import { PlanningPlaceholderResolverService } from '../services/planning-placeholder-resolver.service';

/**
 * Point d'accroche à l'événementiel de la table de marque (spec §3a) : sans
 * logique métier propre, traduit un événement `match-live` TERMINE en appel
 * au resolver, puis revérifie la ou les poules éventuellement concernées
 * (spec §3b) — déduites via le classement, aucune table match↔poule
 * persistée (cf. décision d'architecture 1788719406884).
 */
@Injectable()
export class PlanningPlaceholderResolverListener implements OnModuleInit {
  private readonly logger = new Logger(
    PlanningPlaceholderResolverListener.name,
  );

  constructor(
    private readonly matchStream: MatchStreamService,
    private readonly resolver: PlanningPlaceholderResolverService,
    private readonly editionResolver: EditionResolverService,
    @Inject(PLANNING_MATCH_WRITER)
    private readonly matchWriter: PlanningMatchWriter,
    @Inject(EQUIPE_REPOSITORY)
    private readonly equipeRepo: EquipeRepository,
  ) {}

  onModuleInit(): void {
    this.matchStream.observe().subscribe((event) => {
      if (event.type !== 'match-live' || event.etat !== 'TERMINE') return;
      this.traiterFinDeMatch(event.numMatch).catch((err) =>
        this.logger.error(
          `Échec de résolution de placeholder pour le match ${event.numMatch}: ${err instanceof Error ? err.message : err}`,
        ),
      );
    });
  }

  private async traiterFinDeMatch(numMatch: number): Promise<void> {
    const resultatsBracket =
      await this.resolver.resoudreParConfrontation(numMatch);
    if (resultatsBracket.length > 0) {
      this.logger.log(
        `Match ${numMatch} TERMINE : ${resultatsBracket.length} slot(s) de bracket traité(s)`,
      );
    }

    const equipes = await this.matchWriter.trouverEquipesMatch(numMatch);
    if (!equipes) return;

    const edition = await this.editionResolver.getEditionActive();
    const poulesDejaTraitees = new Set<string>();
    for (const nom of [equipes.equipe1Nom, equipes.equipe2Nom]) {
      const poule = await this.equipeRepo.findClassementByTeamName(nom);
      if (!poule || poulesDejaTraitees.has(poule.pouleCode)) continue;
      poulesDejaTraitees.add(poule.pouleCode);

      const resultatsPoule = await this.resolver.resoudrePoule(
        edition.id,
        poule.pouleCode,
      );
      if (resultatsPoule.length > 0) {
        this.logger.log(
          `Poule ${poule.pouleCode} : ${resultatsPoule.length} slot(s) traité(s) suite au match ${numMatch}`,
        );
      }
    }
  }
}
