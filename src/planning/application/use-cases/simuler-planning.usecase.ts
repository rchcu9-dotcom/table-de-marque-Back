import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PlanningPrismaService } from '../../infrastructure/persistence/planning-prisma.service';
import {
  InscriptionEditionJourRepository,
  INSCRIPTION_EDITION_JOUR_REPOSITORY,
} from '../../domain/repositories/inscription-edition-jour.repository';
import {
  CreneauActiviteRepository,
  CRENEAU_ACTIVITE_REPOSITORY,
} from '../../domain/repositories/creneau-activite.repository';
import { GetParametresSportifsUseCase } from './get-parametres-sportifs.usecase';
import { GetActivitesCatalogueUseCase } from './activite-catalogue/get-activites-catalogue.usecase';
import { EquipesSimulationService } from '../services/equipes-simulation.service';
import { GenerationMatchsService } from '../services/generation-matchs.service';
import { GenerationMatchsGrapheService } from '../services/generation-matchs-graphe.service';
import { FormatGrapheValidationService } from '../services/format-graphe-validation.service';
import { PlacementActivitesService } from '../services/placement-activites.service';
import { VerificationPlanningService } from '../services/verification-planning.service';
import { PlanningSimulationCacheService } from '../services/planning-simulation-cache.service';
import { NumeroMatchAllocator } from '../services/numero-match-allocator';
import { SimulerPlanningDto } from '../dto/simuler-planning.dto';
import {
  SimulationResult,
  ActiviteGeneree,
} from '../../domain/entities/simulation-result.entity';
import { InscEditionJour } from '../../domain/entities/inscription-edition-jour.entity';
import { CreneauActivite } from '../../domain/entities/creneau-activite.entity';
import {
  DEFAULT_DUREE_INTER_MATCH_MIN,
  DEFAULT_FORMAT_PHASE_FINALE,
  DEFAULT_NB_EQUIPES_QUALIFIEES_PAR_POULE,
  DEFAULT_NB_PATINOIRES,
  DEFAULT_NB_POULES,
  buildDefaultMinGap,
} from '../services/default-parametres';
import { GetFormatGrapheUseCase } from './format-graphe/get-format-graphe.usecase';

@Injectable()
export class SimulerPlanningUseCase {
  constructor(
    private readonly prisma: PlanningPrismaService,
    @Inject(INSCRIPTION_EDITION_JOUR_REPOSITORY)
    private readonly joursRepository: InscriptionEditionJourRepository,
    @Inject(CRENEAU_ACTIVITE_REPOSITORY)
    private readonly creneauActiviteRepository: CreneauActiviteRepository,
    private readonly getParametresSportifs: GetParametresSportifsUseCase,
    private readonly getActivitesCatalogue: GetActivitesCatalogueUseCase,
    private readonly equipesSimulation: EquipesSimulationService,
    private readonly generationMatchs: GenerationMatchsService,
    private readonly placementActivites: PlacementActivitesService,
    private readonly verificationPlanning: VerificationPlanningService,
    private readonly cache: PlanningSimulationCacheService,
    @Optional() private readonly getFormatGraphe?: GetFormatGrapheUseCase,
    @Optional()
    private readonly generationMatchsGraphe?: GenerationMatchsGrapheService,
    @Optional()
    private readonly formatGrapheValidation?: FormatGrapheValidationService,
  ) {}

  async execute(
    editionId: number,
    dto: SimulerPlanningDto,
  ): Promise<SimulationResult> {
    const parametresParDefautUtilises: string[] = [];
    const parametres = await this.getParametresSportifs.execute(editionId);

    let jours = await this.joursRepository.findByEdition(editionId);
    if (jours.length === 0) {
      jours = this.joursParDefaut();
      parametresParDefautUtilises.push(
        'jours de compétition (aucun configuré — 3 jours par défaut, 09:00–21:30)',
      );
    }

    const nbPoules = parametres.nbPoules ?? DEFAULT_NB_POULES;
    if (parametres.nbPoules == null)
      parametresParDefautUtilises.push('nbPoules');

    const nbEquipesQualifieesParPoule =
      parametres.nbEquipesQualifieesParPoule ??
      DEFAULT_NB_EQUIPES_QUALIFIEES_PAR_POULE;
    if (parametres.nbEquipesQualifieesParPoule == null)
      parametresParDefautUtilises.push('nbEquipesQualifieesParPoule');

    const formatPhaseFinale =
      parametres.formatPhaseFinale ?? DEFAULT_FORMAT_PHASE_FINALE;
    if (parametres.formatPhaseFinale == null)
      parametresParDefautUtilises.push('formatPhaseFinale');

    const nbPatinoires = parametres.nbPatinoires ?? DEFAULT_NB_PATINOIRES;
    if (parametres.nbPatinoires == null)
      parametresParDefautUtilises.push('nbPatinoires');

    const dureeInterMatchMin =
      parametres.dureeInterMatchMin ?? DEFAULT_DUREE_INTER_MATCH_MIN;
    if (parametres.dureeInterMatchMin == null)
      parametresParDefautUtilises.push('dureeInterMatchMin');

    // Catalogue d'Activités (seed Repas/Challenge au premier appel — §3 de la
    // spec) : nécessaire à la fois pour le placement (créneaux LIBRE
    // rattachés à une ligne de catalogue) et pour le fallback de la matrice
    // de délai (ses clés sont désormais des activiteId, plus des littéraux
    // figés 'repas'/'challenge').
    const activitesCatalogue =
      await this.getActivitesCatalogue.execute(editionId);
    const repasCatalogue =
      activitesCatalogue.find((a) => a.label === 'Repas') ??
      activitesCatalogue[0];
    const challengeCatalogue =
      activitesCatalogue.find((a) => a.label === 'Challenge') ??
      activitesCatalogue[1] ??
      activitesCatalogue[0];
    const delaiMinActivite =
      parametres.delaiMinActivite ??
      (repasCatalogue && challengeCatalogue
        ? buildDefaultMinGap(repasCatalogue.id, challengeCatalogue.id)
        : {});
    if (parametres.delaiMinActivite == null)
      parametresParDefautUtilises.push('delaiMinActivite');

    const nbEquipesCible = dto.nbEquipesCible ?? parametres.nbPlacesMax;
    const { equipes, nbFictif } = await this.equipesSimulation.resoudre(
      editionId,
      nbEquipesCible,
    );

    const [max5v5, max3v3] = await Promise.all([
      this.prisma.taMatch.aggregate({
        _max: { numMatch: true },
        where: { numMatch: { lte: 100 } },
      }),
      this.prisma.taMatch.aggregate({
        _max: { numMatch: true },
        where: { numMatch: { gt: 100 } },
      }),
    ]);
    const allocator = new NumeroMatchAllocator(
      max5v5._max.numMatch ?? 0,
      max3v3._max.numMatch ?? 100,
    );

    // Branche sur le nouveau moteur graphe si disponible ET si le graphe a des phases.
    let generationResult: {
      matches: import('../../domain/entities/match-genere.entity').MatchGenere[];
      qualifies: import('../services/generation-matchs.service').Qualifie[];
    };
    let joursFinale: InscEditionJour[];

    if (
      this.getFormatGraphe &&
      this.generationMatchsGraphe &&
      this.formatGrapheValidation
    ) {
      const graphe = await this.getFormatGraphe.execute(editionId);
      if (graphe.phases.length > 0) {
        // Valider le graphe avant génération
        const validationResult =
          this.formatGrapheValidation.validerActivable(graphe);
        if (!validationResult.valide) {
          throw new Error(
            `Graphe de compétition invalide pour la génération :\n${validationResult.erreurs.join('\n')}`,
          );
        }
        // Construire joursParPhase depuis FormatPhaseJour
        const joursParPhase = new Map<number, InscEditionJour[]>();
        for (const phase of graphe.phases) {
          const joursPhase = jours.filter((j) => phase.joursIds.includes(j.id));
          joursParPhase.set(phase.id, joursPhase);
        }
        generationResult = this.generationMatchsGraphe.genere({
          graphe,
          equipes,
          joursParPhase,
          dureeMatchPouleMin: parametres.dureeMatchPouleMin,
          dureeMatchFinalMin: parametres.dureeMatchFinalMin,
          dureeSurfacageMin: parametres.dureeSurfacageMin,
          dureeInterMatchMin,
          nbPatinoires,
          allocator,
        });
        // Pour le placement des repas, on utilise tous les jours sauf le premier
        joursFinale = jours.slice(1);
      } else {
        // Graphe vide : fallback sur l'ancien moteur
        generationResult = this.generationMatchs.genere({
          equipes,
          jours,
          nbPoules,
          nbEquipesQualifieesParPoule,
          formatPhaseFinale,
          dureeMatchPouleMin: parametres.dureeMatchPouleMin,
          dureeMatchFinalMin: parametres.dureeMatchFinalMin,
          dureeSurfacageMin: parametres.dureeSurfacageMin,
          dureeInterMatchMin,
          nbPatinoires,
          allocator,
        });
        joursFinale = jours.slice(1);
      }
    } else {
      // Services graphe non injectés (mode test ou ancien module) : ancien moteur
      generationResult = this.generationMatchs.genere({
        equipes,
        jours,
        nbPoules,
        nbEquipesQualifieesParPoule,
        formatPhaseFinale,
        dureeMatchPouleMin: parametres.dureeMatchPouleMin,
        dureeMatchFinalMin: parametres.dureeMatchFinalMin,
        dureeSurfacageMin: parametres.dureeSurfacageMin,
        dureeInterMatchMin,
        nbPatinoires,
        allocator,
      });
      joursFinale = jours.slice(1);
    }

    const { matches, qualifies } = generationResult;

    // Créneaux d'activité LIBRE de l'édition (saisis manuellement par
    // l'admin, cf. spec §2.3/§2.5) — regroupés par date pour les rattacher
    // au bon jour de compétition.
    const creneauxLibres =
      await this.creneauActiviteRepository.findLibresByEdition(editionId);
    const dateKey = (d: Date) => d.toISOString().slice(0, 10);
    const creneauxParDate = new Map<string, CreneauActivite[]>();
    for (const c of creneauxLibres) {
      const key = dateKey(c.date);
      if (!creneauxParDate.has(key)) creneauxParDate.set(key, []);
      creneauxParDate.get(key)!.push(c);
    }

    const jourBrassage = jours[0];
    const matchesJourBrassage = matches.filter(
      (m) => m.jour === jourBrassage.numeroJour,
    );
    const { assignations: assignationsJourBrassage, score: scoreBrassage } =
      this.placementActivites.placerActivitesJour({
        candidats: equipes.map((e) => ({ ref: e.ref, nom: e.nom })),
        matchesDuJour: matchesJourBrassage,
        creneauxDuJour: creneauxParDate.get(dateKey(jourBrassage.date)) ?? [],
        activites: activitesCatalogue,
        delaiMinActivite,
      });

    // Jours de qualification/finale : un participant attendu par créneau ce
    // jour-là (qualifiés de poule, identité placeholder tant que J1 n'a pas
    // été joué) — même mécanisme que celui déjà en production pour les
    // matchs J2/J3.
    const participantsParJour =
      this.generationMatchs.participantsAttendusParJour(
        matches,
        qualifies,
        joursFinale,
      );
    let scoreFinale = { penalty: 0, slack: 0 };
    const assignationsFinale = joursFinale.flatMap((jour) => {
      const participants = participantsParJour.get(jour.numeroJour) ?? [];
      const creneauxDuJour = creneauxParDate.get(dateKey(jour.date)) ?? [];
      if (participants.length === 0 || creneauxDuJour.length === 0) return [];
      const matchesDuJour = matches.filter((m) => m.jour === jour.numeroJour);
      const { assignations, score } =
        this.placementActivites.placerActivitesJour({
          candidats: participants,
          matchesDuJour,
          creneauxDuJour,
          activites: activitesCatalogue,
          delaiMinActivite,
        });
      scoreFinale = {
        penalty: scoreFinale.penalty + score.penalty,
        slack: scoreFinale.slack + score.slack,
      };
      return assignations;
    });

    const activites: ActiviteGeneree[] = [
      ...assignationsJourBrassage,
      ...assignationsFinale,
    ];
    const score = {
      penalty: scoreBrassage.penalty + scoreFinale.penalty,
      slack: scoreBrassage.slack + scoreFinale.slack,
    };

    const violations = this.verificationPlanning.verifier({
      matches,
      activites,
      jours,
      delaiMinActivite,
      nbPatinoires,
      equipes,
    });

    const result = new SimulationResult(
      randomUUID(),
      editionId,
      new Date(),
      score,
      violations,
      equipes,
      matches,
      activites,
      {
        parametresParDefautUtilises,
        effectifComplete: nbFictif > 0,
      },
    );

    this.cache.set(editionId, result);
    return result;
  }

  private joursParDefaut(): InscEditionJour[] {
    const aujourdHui = new Date();
    aujourdHui.setHours(0, 0, 0, 0);
    return [1, 2, 3].map((numeroJour) => {
      const date = new Date(
        aujourdHui.getTime() + (numeroJour - 1) * 86_400_000,
      );
      const heureDebut = new Date(date);
      heureDebut.setHours(9, 0, 0, 0);
      const heureFin = new Date(date);
      heureFin.setHours(21, 30, 0, 0);
      return new InscEditionJour(
        -numeroJour,
        0,
        numeroJour,
        date,
        heureDebut,
        heureFin,
        '5V5',
      );
    });
  }
}
