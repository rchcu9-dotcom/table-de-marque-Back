import { Inject, Injectable } from '@nestjs/common';
import { PlanningPrismaService } from '../../infrastructure/persistence/planning-prisma.service';
import {
  InscriptionEditionJourRepository,
  INSCRIPTION_EDITION_JOUR_REPOSITORY,
} from '../../domain/repositories/inscription-edition-jour.repository';
import {
  CreneauActiviteRepository,
  CRENEAU_ACTIVITE_REPOSITORY,
} from '../../domain/repositories/creneau-activite.repository';
import {
  ActiviteCatalogueRepository,
  ACTIVITE_CATALOGUE_REPOSITORY,
} from '../../domain/repositories/activite-catalogue.repository';
import { GetParametresSportifsUseCase } from './get-parametres-sportifs.usecase';
import { VerificationPlanningService } from '../services/verification-planning.service';
import { MatchGenere } from '../../domain/entities/match-genere.entity';
import { EquipeSimulation } from '../../domain/entities/equipe-simulation.entity';
import { ActiviteGeneree } from '../../domain/entities/simulation-result.entity';
import { DEFAULT_NB_PATINOIRES } from '../services/default-parametres';

/**
 * Rejoue le rapport d'anomalies sur le dernier planning confirmé (§8).
 *
 * TA_MATCHS ne porte aucune colonne d'édition (hypothèse mono-tournoi déjà
 * documentée par EditionResolverService) : toutes les lignes existantes sont
 * donc considérées comme relevant de l'édition active, filtrées aux jours
 * configurés pour cette édition (correspondance par date).
 */
@Injectable()
export class GetVerificationPlanningUseCase {
  constructor(
    private readonly prisma: PlanningPrismaService,
    @Inject(INSCRIPTION_EDITION_JOUR_REPOSITORY)
    private readonly joursRepository: InscriptionEditionJourRepository,
    @Inject(CRENEAU_ACTIVITE_REPOSITORY)
    private readonly creneauActiviteRepository: CreneauActiviteRepository,
    @Inject(ACTIVITE_CATALOGUE_REPOSITORY)
    private readonly activiteCatalogueRepository: ActiviteCatalogueRepository,
    private readonly getParametresSportifs: GetParametresSportifsUseCase,
    private readonly verificationPlanning: VerificationPlanningService,
  ) {}

  async execute(editionId: number): Promise<string[]> {
    const [
      jours,
      parametres,
      creneauxConfirmes,
      activitesCatalogue,
      taMatches,
    ] = await Promise.all([
      this.joursRepository.findByEdition(editionId),
      this.getParametresSportifs.execute(editionId),
      this.creneauActiviteRepository.findConfirmesByEdition(editionId),
      this.activiteCatalogueRepository.findByEdition(editionId),
      this.prisma.taMatch.findMany({ where: { surfacage: 0 } }),
    ]);

    const dateToJour = new Map(
      jours.map((j) => [j.date.toISOString().slice(0, 10), j.numeroJour]),
    );

    const matches: MatchGenere[] = [];
    for (const row of taMatches) {
      const dateKey = row.dateHeure.toISOString().slice(0, 10);
      const jour = dateToJour.get(dateKey);
      if (jour == null) continue;
      matches.push(
        new MatchGenere(
          row.numMatch,
          jour,
          row.matchCase,
          row.equipeId1 != null
            ? `real:${row.equipeId1}`
            : `placeholder:${row.equipe1}`,
          row.equipe1,
          row.equipeId2 != null
            ? `real:${row.equipeId2}`
            : `placeholder:${row.equipe2}`,
          row.equipe2,
          row.dateHeure,
          row.numMatch > 100
            ? parametres.dureeMatchFinalMin
            : parametres.dureeMatchPouleMin,
          row.numMatch > 100,
          null,
          'BRASSAGE',
        ),
      );
    }

    const labelParActiviteId = new Map(
      activitesCatalogue.map((a) => [a.id, a.label]),
    );
    const activites: ActiviteGeneree[] = creneauxConfirmes.map((c) => ({
      creneauId: c.id,
      activiteId: c.activiteId,
      activiteLabel:
        labelParActiviteId.get(c.activiteId) ?? `Activité ${c.activiteId}`,
      equipeRef:
        c.equipeId != null
          ? `real:${c.equipeId}`
          : `placeholder:${c.equipeLabel}`,
      equipeNom: c.equipeId != null ? `#${c.equipeId}` : (c.equipeLabel ?? ''),
      debut: c.heureDebut,
      fin: new Date(c.heureDebut.getTime() + c.dureeMin * 60_000),
    }));

    const equipeIds = new Set<number>();
    for (const m of matches) {
      if (m.equipe1Ref.startsWith('real:'))
        equipeIds.add(Number(m.equipe1Ref.slice(5)));
      if (m.equipe2Ref.startsWith('real:'))
        equipeIds.add(Number(m.equipe2Ref.slice(5)));
    }
    const equipes: EquipeSimulation[] = [...equipeIds].map(
      (id) => new EquipeSimulation(`real:${id}`, `#${id}`, false, id),
    );

    return this.verificationPlanning.verifier({
      matches,
      activites,
      jours,
      delaiMinActivite: parametres.delaiMinActivite,
      nbPatinoires: parametres.nbPatinoires ?? DEFAULT_NB_PATINOIRES,
      equipes,
    });
  }
}
