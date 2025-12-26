import { Inject, Injectable } from '@nestjs/common';
import { ATELIER_REPOSITORY, AtelierRepository } from '@/domain/challenge/repositories/atelier.repository';
import { TENTATIVE_ATELIER_REPOSITORY, TentativeAtelierRepository } from '@/domain/challenge/repositories/tentative-atelier.repository';
import { JOUEUR_REPOSITORY, JoueurRepository } from '@/domain/joueur/repositories/joueur.repository';
import { AtelierType } from '@/domain/challenge/entities/atelier.entity';
import { TentativeMetrics } from '@/domain/challenge/entities/tentative-atelier.entity';

type AttemptView = {
  joueurId: string;
  joueurName: string;
  atelierId: string;
  atelierLabel: string;
  atelierType: AtelierType;
  phase: string;
  metrics: TentativeMetrics;
  attemptDate: Date;
};

type ChallengeEquipeResponse = {
  equipeId: string;
  equipeName: string | null;
  jour1: AttemptView[];
  jour3: AttemptView[];
  autres: AttemptView[];
};

@Injectable()
export class GetChallengeByEquipeUseCase {
  constructor(
    @Inject(ATELIER_REPOSITORY) private readonly atelierRepo: AtelierRepository,
    @Inject(TENTATIVE_ATELIER_REPOSITORY) private readonly tentativeRepo: TentativeAtelierRepository,
    @Inject(JOUEUR_REPOSITORY) private readonly joueurRepo: JoueurRepository,
  ) {}

  async execute(equipeId: string): Promise<ChallengeEquipeResponse> {
    const joueurs = await this.joueurRepo.findByEquipe(equipeId);
    const joueurMap = new Map(joueurs.map((j) => [j.id, j]));
    const ateliers = await this.atelierRepo.findAll();
    const atelierMap = new Map(ateliers.map((a) => [a.id, a]));

    const tentatives = (await this.tentativeRepo.findAll()).filter((t) => joueurMap.has(t.joueurId));

    const grouped: ChallengeEquipeResponse = {
      equipeId,
      equipeName: joueurs[0]?.equipeId ?? equipeId,
      jour1: [],
      jour3: [],
      autres: [],
    };

    const jour1Map = new Map<string, AttemptView>();
    const jour3Map = new Map<string, AttemptView>();
    const autresMap = new Map<string, AttemptView>();

    const shouldReplace = (existing: AttemptView, candidate: AttemptView) => {
      const type = candidate.atelierType;
      if (type === 'tir') {
        return (candidate.metrics as any).totalPoints > (existing.metrics as any).totalPoints;
      }
      if (type === 'vitesse' || type === 'glisse_crosse') {
        return (candidate.metrics as any).tempsMs < (existing.metrics as any).tempsMs;
      }
      return false;
    };

    for (const t of tentatives) {
      const atelier = atelierMap.get(t.atelierId);
      if (!atelier) continue;
      const joueur = joueurMap.get(t.joueurId);
      const view: AttemptView = {
        joueurId: t.joueurId,
        joueurName: joueur?.nom ?? t.joueurId,
        atelierId: atelier.id,
        atelierLabel: atelier.label,
        atelierType: atelier.type,
        phase: atelier.phase,
        metrics: t.metrics,
        attemptDate: t.createdAt,
      };

      const nameKey = (joueur?.nom ?? t.joueurId).trim().toLowerCase();
      const key = `${atelier.id}-${nameKey}`;

      if (atelier.phase.toLowerCase().includes('jour 1')) {
        const current = jour1Map.get(key);
        if (!current || shouldReplace(current, view)) jour1Map.set(key, view);
      } else if (atelier.phase.toLowerCase().includes('jour 3')) {
        const current = jour3Map.get(key);
        if (!current || shouldReplace(current, view)) jour3Map.set(key, view);
      } else {
        const current = autresMap.get(key);
        if (!current || shouldReplace(current, view)) autresMap.set(key, view);
      }
    }

    grouped.jour1 = Array.from(jour1Map.values());
    grouped.jour3 = Array.from(jour3Map.values());
    grouped.autres = Array.from(autresMap.values());

    return grouped;
  }
}
