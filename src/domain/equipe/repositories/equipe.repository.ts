import { Equipe, PouleClassement, PouleCode } from '../entities/equipe.entity';

export const EQUIPE_REPOSITORY = Symbol('EQUIPE_REPOSITORY');

/**
 * Implémentation "historique" (ta_classement MySQL ou CSV Google Sheets,
 * selon EQUIPE_REPOSITORY_DRIVER) injectée derrière le décorateur
 * ClassementInterneEquipeRepository (qui, lui, est fourni sous
 * EQUIPE_REPOSITORY). Sert de source pour les champs non sportifs et pour
 * les pouleCode hors périmètre du moteur interne (J3, challenge).
 */
export const EQUIPE_REPOSITORY_LEGACY = Symbol('EQUIPE_REPOSITORY_LEGACY');

export abstract class EquipeRepository {
  abstract findClassementByPoule(
    code: PouleCode,
  ): Promise<PouleClassement | null>;

  abstract findClassementByTeamName(
    teamName: string,
  ): Promise<PouleClassement | null>;

  abstract findAllEquipes(): Promise<Equipe[]>;

  abstract findEquipeById(id: string): Promise<Equipe | null>;
}
