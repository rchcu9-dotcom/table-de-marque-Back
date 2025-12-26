import { Joueur } from '../entities/joueur.entity';

export const JOUEUR_REPOSITORY = Symbol('JOUEUR_REPOSITORY');

export abstract class JoueurRepository {
  abstract create(joueur: Joueur): Promise<Joueur>;
  abstract findAll(): Promise<Joueur[]>;
  abstract findById(id: string): Promise<Joueur | null>;
  abstract findByEquipe(equipeId: string): Promise<Joueur[]>;
  abstract update(joueur: Joueur): Promise<Joueur>;
  abstract delete(id: string): Promise<void>;
}

// Internal token used to bind the underlying driver (mock, sheets, etc.)
export const JOUEUR_REPOSITORY_SOURCE = Symbol('JOUEUR_REPOSITORY_SOURCE');
