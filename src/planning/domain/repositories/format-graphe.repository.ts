import { FormatGraphe } from '../entities/format/format-graphe.entity';
import { FormatGroupe } from '../entities/format/format-groupe.entity';
import { FormatLien } from '../entities/format/format-lien.entity';
import { FormatMeta } from '../entities/format/format-meta.entity';
import { FormatPhase } from '../entities/format/format-phase.entity';
import { FormatPlace } from '../entities/format/format-place.entity';
import { FormatGroupeFormule } from '../enums/format-groupe-formule.enum';

/**
 * Structure en mémoire produite par le générateur de preset, avant toute
 * persistance. Les références sont des ordres relatifs (pas des ids).
 */
export type FormatGraphePropose = {
  phases: {
    nom: string;
    ordre: number;
    groupes: { nom: string; ordre: number; nbPlaces: number }[];
  }[];
  liens: {
    phaseOrdreSource: number;
    groupeOrdreSource: number;
    rangSource: number;
    phaseOrdreCible: number | null;
    groupeOrdreCible: number | null;
    etat: 'ELIMINE' | 'LIE' | 'NON_DEFINI';
  }[];
};

export const FORMAT_GRAPHE_REPOSITORY = Symbol('FORMAT_GRAPHE_REPOSITORY');

export abstract class FormatGrapheRepository {
  abstract getGraphe(editionId: number): Promise<FormatGraphe>;
  abstract createPhase(
    editionId: number,
    nom: string,
    ordre: number,
  ): Promise<FormatPhase>;
  abstract updatePhase(id: number, nom: string): Promise<FormatPhase>;
  abstract deletePhase(id: number): Promise<void>;
  abstract reordonnerPhases(
    editionId: number,
    ordreIds: number[],
  ): Promise<void>;
  abstract createGroupe(phaseId: number, nom: string): Promise<FormatGroupe>;
  /**
   * Mise à jour partielle : seuls les champs fournis (nom et/ou formule) sont
   * modifiés. Ne touche jamais aux places ni aux liens du groupe.
   */
  abstract updateGroupe(
    id: number,
    data: { nom?: string; formule?: FormatGroupeFormule },
  ): Promise<FormatGroupe>;
  abstract deleteGroupe(id: number): Promise<void>;
  /**
   * Ajoute une Place d'origine ALIAS dans le groupe et crée/synchronise le
   * FormatLien NON_DEFINI correspondant au nouveau rang sortant.
   */
  abstract ajouterPlaceAlias(
    groupeId: number,
    aliasLabel: string,
  ): Promise<FormatPlace>;
  abstract supprimerPlace(id: number): Promise<void>;
  /**
   * Crée la FormatPlace cible dans groupeCibleId et passe le lien à l'état LIE.
   * Si un lien existait déjà pour ce rang avec une autre cible, le remplace
   * proprement (erreur 409 si la cible avait déjà un lien sortant LIE).
   */
  abstract definirLien(
    groupeSourceId: number,
    rangSource: number,
    groupeCibleId: number,
  ): Promise<FormatLien>;
  abstract marquerElimine(
    groupeSourceId: number,
    rangSource: number,
  ): Promise<FormatLien>;
  /**
   * Retourne le lien à NON_DEFINI. Supprime la place cible si elle existe et
   * n'a pas de lien sortant LIE (sinon 409 explicite).
   */
  abstract reinitialiserLien(
    groupeSourceId: number,
    rangSource: number,
  ): Promise<FormatLien>;
  abstract associerPhaseJour(
    phaseId: number,
    editionJourId: number,
  ): Promise<void>;
  abstract dissocierPhaseJour(
    phaseId: number,
    editionJourId: number,
  ): Promise<void>;
  /**
   * Transaction : supprime tout le graphe existant de l'édition et recrée
   * depuis la structure proposée par le générateur de preset.
   */
  abstract remplacerGrapheComplet(
    editionId: number,
    graphe: FormatGraphePropose,
  ): Promise<FormatGraphe>;
  abstract getMeta(editionId: number): Promise<FormatMeta | null>;
  abstract marquerModifieManuellement(editionId: number): Promise<void>;
}
