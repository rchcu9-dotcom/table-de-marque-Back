import { Inject, Injectable } from '@nestjs/common';
import { ATELIER_REPOSITORY, AtelierRepository } from '@/domain/challenge/repositories/atelier.repository';
import { TENTATIVE_ATELIER_REPOSITORY, TentativeAtelierRepository } from '@/domain/challenge/repositories/tentative-atelier.repository';
import { JOUEUR_REPOSITORY, JoueurRepository } from '@/domain/joueur/repositories/joueur.repository';
import { AtelierType } from '@/domain/challenge/entities/atelier.entity';
import { TentativeMetrics } from '@/domain/challenge/entities/tentative-atelier.entity';
import { EQUIPE_REPOSITORY, EquipeRepository } from '@/domain/equipe/repositories/equipe.repository';

export type ChallengeAttemptView = {
  joueurId: string;
  joueurName: string;
  equipeId: string | null;
  equipeName: string | null;
  equipeLogoUrl: string | null;
  atelierId: string;
  atelierLabel: string;
  atelierType: AtelierType;
  phase: string;
  metrics: TentativeMetrics;
  attemptDate: Date;
};

export type ChallengeAllResponse = {
  jour1: ChallengeAttemptView[];
  jour3: ChallengeAttemptView[];
  autres: ChallengeAttemptView[];
};

@Injectable()
export class GetChallengeAllUseCase {
  constructor(
    @Inject(ATELIER_REPOSITORY) private readonly atelierRepo: AtelierRepository,
    @Inject(TENTATIVE_ATELIER_REPOSITORY) private readonly tentativeRepo: TentativeAtelierRepository,
    @Inject(JOUEUR_REPOSITORY) private readonly joueurRepo: JoueurRepository,
    @Inject(EQUIPE_REPOSITORY) private readonly equipeRepo: EquipeRepository,
  ) {}

  async execute(teamId?: string): Promise<ChallengeAllResponse> {
    const teamFilter = teamId?.toLowerCase().trim() || null;
    const joueurs = await this.joueurRepo.findAll();
    const joueurMap = new Map(joueurs.map((j) => [j.id, j]));
    const equipes = await this.equipeRepo.findAllEquipes();
    const equipeMap = new Map(equipes.map((e) => [e.id.toLowerCase(), e]));
    const ateliers = await this.atelierRepo.findAll();
    const atelierMap = new Map(ateliers.map((a) => [a.id, a]));

    const tentatives = await this.tentativeRepo.findAll();

    const grouped: ChallengeAllResponse = {
      jour1: [],
      jour3: [],
      autres: [],
    };

    const jour1Map = new Map<string, ChallengeAttemptView>();
    const jour3Map = new Map<string, ChallengeAttemptView>();
    const autresMap = new Map<string, ChallengeAttemptView>();

    const shouldReplace = (existing: ChallengeAttemptView, candidate: ChallengeAttemptView) => {
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
      const joueur = joueurMap.get(t.joueurId);
      if (!atelier || !joueur) continue;

      const equipeId = (joueur.equipeId ?? '').toLowerCase();
      if (teamFilter && equipeId !== teamFilter) continue;

      const equipe = equipeMap.get(equipeId);
      const view: ChallengeAttemptView = {
        joueurId: t.joueurId,
        joueurName: joueur.nom,
        equipeId: joueur.equipeId ?? null,
        equipeName: equipe?.name ?? joueur.equipeId ?? null,
        equipeLogoUrl: equipe?.logoUrl ?? null,
        atelierId: atelier.id,
        atelierLabel: atelier.label,
        atelierType: atelier.type,
        phase: atelier.phase,
        metrics: t.metrics,
        attemptDate: t.createdAt,
      };

      const nameKey = joueur.nom.trim().toLowerCase();
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
