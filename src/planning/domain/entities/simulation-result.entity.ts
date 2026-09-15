import { EquipeSimulation } from './equipe-simulation.entity';
import { MatchGenere } from './match-genere.entity';

export type ActiviteGeneree = {
  creneauId: number;
  activiteId: number;
  activiteLabel: string;
  equipeRef: string;
  equipeNom: string;
  debut: Date;
  fin: Date;
};

export type ScoreSimulation = {
  penalty: number;
  slack: number;
};

export type SimulationMode = {
  parametresParDefautUtilises: string[]; // libellés des champs non confirmés (valeurs par défaut du script legacy)
  effectifComplete: boolean; // true si des équipes fictives ont été ajoutées
};

export class SimulationResult {
  constructor(
    public readonly id: string,
    public readonly editionId: number,
    public readonly generatedAt: Date,
    public readonly score: ScoreSimulation,
    public readonly violations: string[],
    public readonly equipes: EquipeSimulation[],
    public readonly matches: MatchGenere[],
    public readonly activites: ActiviteGeneree[],
    public readonly mode: SimulationMode,
  ) {}
}
