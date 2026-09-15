import { MatchGenere } from '../entities/match-genere.entity';
import { PlacementCote } from '../entities/planning-match-slot.entity';

export const PLANNING_MATCH_WRITER = Symbol('PLANNING_MATCH_WRITER');

export type EquipesMatch = {
  equipeId1: number | null;
  equipeId2: number | null;
  equipe1Nom: string;
  equipe2Nom: string;
};

/**
 * Seule porte d'écriture sur TA_MATCHS de tout le repo (D11). Isolée du
 * MySqlMatchRepository (qui reste strictement lecture seule pour tous ses
 * consommateurs existants) car le module planning est le producteur déclaré
 * du calendrier initial, pas un consommateur.
 *
 * `equipeIdByRef` résout les refs en mémoire ("real:<id>") vers les
 * TaEquipe.id réels — n'est jamais appelé avec des refs fictives ("fictive:*"),
 * la confirmation étant bloquée tant qu'il en reste (cf. confirmer-planning.usecase).
 */
export abstract class PlanningMatchWriter {
  abstract ecrireMatchs(
    matches: MatchGenere[],
    equipeIdByRef: Map<string, number>,
    editionId: number,
  ): Promise<number>;

  /**
   * Résolution d'un placeholder de planning une fois l'équipe réelle connue
   * (spec "lors-du-déroulement-live..." §5) : met à jour TA_MATCHS puis
   * marque le PlanningMatchSlot correspondant comme résolu.
   */
  abstract resoudreSlot(
    numMatch: number,
    cote: PlacementCote,
    equipeId: number,
    equipeNom: string,
  ): Promise<void>;

  /**
   * Lecture des équipes réelles d'un match déjà écrit dans TA_MATCHS —
   * nécessaire pour déterminer le vainqueur d'un match de bracket
   * (EQUIPE_ID1/2 associés au score le plus haut sur MatchLive).
   */
  abstract trouverEquipesMatch(numMatch: number): Promise<EquipesMatch | null>;

  /**
   * Résolution d'un identifiant numérique d'équipe à partir de son nom —
   * nécessaire car `EquipeRepository`/`Equipe.id` (classement, driver
   * potentiellement Google Sheets) expose le nom comme identifiant, jamais
   * l'ID numérique `TA_EQUIPES.ID` requis pour écrire `EQUIPE_ID{cote}`.
   * Correspondance par nom exact (même limite que le matching TaEquipe ↔
   * InscEquipeReferentiel avant l'ajout de la FK equipeRefId).
   */
  abstract trouverEquipeIdParNom(nom: string): Promise<number | null>;

  /** Symétrique de `trouverEquipeIdParNom`, pour la résolution manuelle (spec §6, DTO ne porte que equipeId). */
  abstract trouverEquipeNomParId(equipeId: number): Promise<string | null>;
}
