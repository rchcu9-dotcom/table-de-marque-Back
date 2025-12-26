import { Inject, Injectable } from '@nestjs/common';
import { JOUEUR_REPOSITORY, JoueurRepository } from '@/domain/joueur/repositories/joueur.repository';
import { Joueur } from '@/domain/joueur/entities/joueur.entity';

@Injectable()
export class GetJoueursByEquipeUseCase {
  constructor(
    @Inject(JOUEUR_REPOSITORY)
    private readonly joueurRepo: JoueurRepository,
  ) {}

  async execute(equipeId: string): Promise<Joueur[]> {
    return this.joueurRepo.findByEquipe(equipeId);
  }
}
