import { EquipeSimulation } from '../../../domain/entities/equipe-simulation.entity';
import { InscEditionJour } from '../../../domain/entities/inscription-edition-jour.entity';
import { MatchGenere } from '../../../domain/entities/match-genere.entity';
import { ParametresSportifs } from '../../../domain/entities/parametres-sportifs.entity';
import { ActiviteCatalogue } from '../../../domain/entities/activite-catalogue.entity';
import { CreneauActivite } from '../../../domain/entities/creneau-activite.entity';
import { CreneauActiviteStatut } from '../../../domain/enums/creneau-activite-statut.enum';
import {
  ActiviteGeneree,
  SimulationResult,
} from '../../../domain/entities/simulation-result.entity';
import { FormatPhaseFinale } from '../../../domain/enums/format-phase-finale.enum';

export function makeEquipe(
  overrides: Partial<{
    ref: string;
    nom: string;
    fictive: boolean;
    equipeId: number | null;
  }> = {},
): EquipeSimulation {
  return new EquipeSimulation(
    overrides.ref ?? 'real:1',
    overrides.nom ?? 'Équipe A',
    overrides.fictive ?? false,
    'equipeId' in overrides ? (overrides.equipeId ?? null) : 1,
  );
}

export function makeEquipesReelles(n: number): EquipeSimulation[] {
  return Array.from({ length: n }, (_, i) =>
    makeEquipe({
      ref: `real:${i + 1}`,
      nom: `Équipe ${i + 1}`,
      equipeId: i + 1,
    }),
  );
}

export function makeJour(
  overrides: Partial<{
    id: number;
    editionId: number;
    numeroJour: number;
    date: Date;
    heureDebut: Date;
    heureFin: Date;
    typeJournee: '5V5' | '3V3' | 'MIXTE';
  }> = {},
): InscEditionJour {
  const date = overrides.date ?? new Date('2026-05-23T00:00:00.000Z');
  return new InscEditionJour(
    overrides.id ?? 1,
    overrides.editionId ?? 1,
    overrides.numeroJour ?? 1,
    date,
    overrides.heureDebut ?? new Date('2026-05-23T09:00:00.000Z'),
    overrides.heureFin ?? new Date('2026-05-23T21:30:00.000Z'),
    overrides.typeJournee ?? '5V5',
  );
}

export function makeParametresSportifs(
  overrides: Partial<ParametresSportifs> = {},
): ParametresSportifs {
  return new ParametresSportifs(
    overrides.editionId ?? 1,
    overrides.dureeSurfacageMin ?? 20,
    overrides.dureeMatchPouleMin ?? 27,
    overrides.dureeMatchFinalMin ?? 33,
    overrides.dureeInterMatchMin ?? null,
    overrides.delaiMinActivite ?? null,
    overrides.nbPatinoires ?? null,
    overrides.nbPoules ?? null,
    overrides.nbEquipesParPoule ?? null,
    overrides.nbEquipesQualifieesParPoule ?? null,
    overrides.formatPhaseFinale ?? null,
    overrides.reglesTieBreak ?? null,
    overrides.nbPlacesMax ?? 16,
  );
}

export function makeMatchGenere(
  overrides: Partial<{
    numMatch: number;
    jour: number;
    matchCase: number;
    equipe1Ref: string;
    equipe1Nom: string;
    equipe2Ref: string;
    equipe2Nom: string;
    dateHeure: Date;
    dureeMin: number;
    is3v3: boolean;
    poule: string | null;
    phase: 'BRASSAGE' | 'QUALIFICATION' | 'FINALE';
    refVainqueurProduit: string | null;
    groupeId: number | null;
    refPerdantProduit: string | null;
  }> = {},
): MatchGenere {
  return new MatchGenere(
    overrides.numMatch ?? 1,
    overrides.jour ?? 1,
    overrides.matchCase ?? 1,
    overrides.equipe1Ref ?? 'real:1',
    overrides.equipe1Nom ?? 'Équipe 1',
    overrides.equipe2Ref ?? 'real:2',
    overrides.equipe2Nom ?? 'Équipe 2',
    overrides.dateHeure ?? new Date('2026-05-23T09:00:00.000Z'),
    overrides.dureeMin ?? 27,
    overrides.is3v3 ?? false,
    overrides.poule ?? 'A',
    overrides.phase ?? 'BRASSAGE',
    overrides.refVainqueurProduit ?? null,
    overrides.groupeId ?? null,
    overrides.refPerdantProduit ?? null,
  );
}

export function makeActiviteGeneree(
  overrides: Partial<ActiviteGeneree> = {},
): ActiviteGeneree {
  return {
    creneauId: overrides.creneauId ?? 1,
    activiteId: overrides.activiteId ?? 1,
    activiteLabel: overrides.activiteLabel ?? 'Repas',
    equipeRef: overrides.equipeRef ?? 'real:1',
    equipeNom: overrides.equipeNom ?? 'Équipe 1',
    debut: overrides.debut ?? new Date('2026-05-23T11:00:00.000Z'),
    fin: overrides.fin ?? new Date('2026-05-23T11:40:00.000Z'),
  };
}

export function makeActiviteCatalogue(
  overrides: Partial<{
    id: number;
    editionId: number;
    label: string;
    dureeParEquipeMin: number;
    capaciteParallele: number;
    createdAt: Date;
  }> = {},
): ActiviteCatalogue {
  return new ActiviteCatalogue(
    overrides.id ?? 1,
    overrides.editionId ?? 1,
    overrides.label ?? 'Repas',
    overrides.dureeParEquipeMin ?? 40,
    overrides.capaciteParallele ?? 4,
    overrides.createdAt ?? new Date('2026-05-01T00:00:00.000Z'),
  );
}

export function makeCreneauActivite(
  overrides: Partial<{
    id: number;
    editionId: number;
    activiteId: number;
    date: Date;
    heureDebut: Date;
    dureeMin: number;
    equipeId: number | null;
    equipeLabel: string | null;
    statut: CreneauActiviteStatut;
    createdAt: Date;
  }> = {},
): CreneauActivite {
  return new CreneauActivite(
    overrides.id ?? 1,
    overrides.editionId ?? 1,
    overrides.activiteId ?? 1,
    overrides.date ?? new Date('2026-05-23T00:00:00.000Z'),
    overrides.heureDebut ?? new Date('2026-05-23T11:00:00.000Z'),
    overrides.dureeMin ?? 40,
    'equipeId' in overrides ? (overrides.equipeId ?? null) : null,
    'equipeLabel' in overrides ? (overrides.equipeLabel ?? null) : null,
    overrides.statut ?? CreneauActiviteStatut.LIBRE,
    overrides.createdAt ?? new Date('2026-05-01T00:00:00.000Z'),
  );
}

export function makeSimulationResult(
  overrides: Partial<{
    id: string;
    editionId: number;
    generatedAt: Date;
    score: { penalty: number; slack: number };
    violations: string[];
    equipes: EquipeSimulation[];
    matches: MatchGenere[];
    activites: SimulationResult['activites'];
    mode: SimulationResult['mode'];
  }> = {},
): SimulationResult {
  return new SimulationResult(
    overrides.id ?? 'sim-1',
    overrides.editionId ?? 1,
    overrides.generatedAt ?? new Date('2026-09-05T10:00:00.000Z'),
    overrides.score ?? { penalty: 0, slack: 0 },
    overrides.violations ?? [],
    overrides.equipes ?? makeEquipesReelles(2),
    overrides.matches ?? [makeMatchGenere()],
    overrides.activites ?? [],
    overrides.mode ?? {
      parametresParDefautUtilises: [],
      effectifComplete: false,
    },
  );
}

export const FORMAT_PHASE_FINALE = FormatPhaseFinale;
