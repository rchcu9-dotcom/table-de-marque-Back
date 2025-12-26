import { Injectable } from '@nestjs/common';
import { Atelier } from '../entities/atelier.entity';
import { TentativeAtelier } from '../entities/tentative-atelier.entity';

export type ClassementEntry = {
  joueurId: string;
  atelierId: string;
  ordre: number;
  score: number;
  extra?: Record<string, unknown>;
};

@Injectable()
export class ClassementService {
  compute(atelier: Atelier, tentatives: TentativeAtelier[]): ClassementEntry[] {
    const withScore = tentatives.map((t) => ({
      tentative: t,
      score: this.getScoreValue(t),
    }));

    const sorted =
      atelier.type === 'tir'
        ? withScore.sort((a, b) => b.score - a.score) // tir => points décroissants
        : withScore.sort((a, b) => a.score - b.score); // temps asc pour vitesse/glisse

    return sorted.map((item, idx) => ({
      joueurId: item.tentative.joueurId,
      atelierId: atelier.id,
      ordre: idx + 1,
      score: item.score,
      extra: this.formatExtra(item.tentative),
    }));
  }

  private getScoreValue(tentative: TentativeAtelier): number {
    if (tentative.metrics.type === 'tir') {
      return tentative.metrics.totalPoints ?? tentative.metrics.tirs.reduce((a, b) => a + b, 0);
    }
    if (tentative.metrics.type === 'glisse_crosse') {
      return tentative.metrics.tempsMs + (tentative.metrics.penalites ?? 0) * 5000;
    }
    return tentative.metrics.tempsMs;
  }

  private formatExtra(tentative: TentativeAtelier): Record<string, unknown> {
    if (tentative.metrics.type === 'tir') {
      return { tirs: tentative.metrics.tirs, total: tentative.metrics.totalPoints };
    }
    if (tentative.metrics.type === 'glisse_crosse') {
      return { tempsMs: tentative.metrics.tempsMs, penalites: tentative.metrics.penalites };
    }
    return { tempsMs: tentative.metrics.tempsMs };
  }
}
