import { Inject, Injectable } from '@nestjs/common';
import { Joueur } from '@/domain/joueur/entities/joueur.entity';
import { JOUEUR_REPOSITORY, JoueurRepository } from '@/domain/joueur/repositories/joueur.repository';

@Injectable()
export class GetAllJoueursUseCase {
  constructor(
    @Inject(JOUEUR_REPOSITORY)
    private readonly joueurRepo: JoueurRepository,
  ) {}

  async execute(): Promise<Joueur[]> {
    return this.joueurRepo.findAll();
  }
}
