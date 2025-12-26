import { Equipe, PouleClassement, PouleCode } from '../entities/equipe.entity';

export const EQUIPE_REPOSITORY = Symbol('EQUIPE_REPOSITORY');

export abstract class EquipeRepository {
  abstract findClassementByPoule(code: PouleCode): Promise<PouleClassement | null>;

  abstract findClassementByTeamName(teamName: string): Promise<PouleClassement | null>;

  abstract findAllEquipes(): Promise<Equipe[]>;

  abstract findEquipeById(id: string): Promise<Equipe | null>;
}
