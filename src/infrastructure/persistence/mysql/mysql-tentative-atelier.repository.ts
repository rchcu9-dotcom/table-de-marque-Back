import { Injectable } from '@nestjs/common';
import { TentativeAtelier } from '@/domain/challenge/entities/tentative-atelier.entity';
import { TentativeAtelierRepository } from '@/domain/challenge/repositories/tentative-atelier.repository';
import { PrismaService } from './prisma.service';

type TaJoueurRow = {
  ID: number;
  EQUIPE_ID: number;
  TIME_VITESSE: number;
  TIME_SLALOM: number;
  NB_PORTES: number;
  TIR1: number | null;
  TIR2: number | null;
  TIR3: number | null;
};

type TaEquipeRow = {
  ID: number;
  CHALLENGE_SAMEDI: Date | null;
};

@Injectable()
export class MySqlTentativeAtelierRepository implements TentativeAtelierRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(_tentative: TentativeAtelier): Promise<TentativeAtelier> {
    throw new Error('MySQL repository is read-only.');
  }

  async clear(): Promise<void> {
    throw new Error('MySQL repository is read-only.');
  }

  async findAll(): Promise<TentativeAtelier[]> {
    const [joueurs, equipes] = await Promise.all([
      this.prisma.$queryRaw<TaJoueurRow[]>`
        SELECT ID, EQUIPE_ID, TIME_VITESSE, TIME_SLALOM, NB_PORTES, TIR1, TIR2, TIR3
        FROM ta_joueurs
      `,
      this.prisma.$queryRaw<TaEquipeRow[]>`
        SELECT ID, CHALLENGE_SAMEDI FROM ta_equipes
      `,
    ]);

    const challengeByEquipe = new Map<number, Date>();
    equipes.forEach((row) => {
      if (row.CHALLENGE_SAMEDI) {
        challengeByEquipe.set(row.ID, new Date(row.CHALLENGE_SAMEDI));
      }
    });

    const attempts: TentativeAtelier[] = [];
    joueurs.forEach((row) => {
      const baseDate =
        challengeByEquipe.get(row.EQUIPE_ID) ?? new Date();
      const vitesse = Math.max(0, row.TIME_VITESSE ?? 0);
      const slalom = Math.max(0, row.TIME_SLALOM ?? 0);
      const penalites = Math.max(0, row.NB_PORTES ?? 0);
      const tirs = [row.TIR1, row.TIR2, row.TIR3].map((v) =>
        typeof v === 'number' ? v : 0,
      );
      const total = tirs.reduce((a, b) => a + b, 0);

      attempts.push(
        new TentativeAtelier(
          `${row.ID}-vitesse`,
          'atelier-vitesse',
          String(row.ID),
          'vitesse',
          { type: 'vitesse', tempsMs: vitesse },
          baseDate,
        ),
      );
      attempts.push(
        new TentativeAtelier(
          `${row.ID}-tir`,
          'atelier-tir',
          String(row.ID),
          'tir',
          { type: 'tir', tirs, totalPoints: total },
          baseDate,
        ),
      );
      attempts.push(
        new TentativeAtelier(
          `${row.ID}-glisse`,
          'atelier-glisse',
          String(row.ID),
          'glisse_crosse',
          { type: 'glisse_crosse', tempsMs: slalom, penalites },
          baseDate,
        ),
      );
    });

    return attempts;
  }

  async findByAtelier(atelierId: string): Promise<TentativeAtelier[]> {
    const all = await this.findAll();
    return all.filter((t) => t.atelierId === atelierId);
  }
}
