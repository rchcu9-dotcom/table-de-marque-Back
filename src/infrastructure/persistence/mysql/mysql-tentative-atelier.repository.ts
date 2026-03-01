import { Injectable } from '@nestjs/common';
import { TentativeAtelier } from '@/domain/challenge/entities/tentative-atelier.entity';
import { TentativeAtelierRepository } from '@/domain/challenge/repositories/tentative-atelier.repository';
import { PrismaService } from './prisma.service';
import { parseParisSqlDateTime } from './date-paris.utils';

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
  CHALLENGE_SAMEDI_SQL: string | null;
};

@Injectable()
export class MySqlTentativeAtelierRepository implements TentativeAtelierRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(tentative: TentativeAtelier): Promise<TentativeAtelier> {
    void tentative;
    return Promise.reject(new Error('MySQL repository is read-only.'));
  }

  clear(): Promise<void> {
    return Promise.reject(new Error('MySQL repository is read-only.'));
  }

  async findAll(): Promise<TentativeAtelier[]> {
    const [joueurs, equipes] = await Promise.all([
      this.prisma.$queryRaw<TaJoueurRow[]>`
        SELECT ID, EQUIPE_ID, TIME_VITESSE, TIME_SLALOM, NB_PORTES, TIR1, TIR2, TIR3
        FROM ta_joueurs
      `,
      this.prisma.$queryRaw<TaEquipeRow[]>`
        SELECT ID,
               DATE_FORMAT(CHALLENGE_SAMEDI, '%Y-%m-%d %H:%i:%s') AS CHALLENGE_SAMEDI_SQL
        FROM ta_equipes
      `,
    ]);

    const challengeByEquipe = new Map<number, Date>();
    equipes.forEach((row) => {
      const challengeDate = parseParisSqlDateTime(row.CHALLENGE_SAMEDI_SQL);
      if (challengeDate) {
        challengeByEquipe.set(row.ID, challengeDate);
      }
    });

    const attempts: TentativeAtelier[] = [];
    joueurs.forEach((row) => {
      const baseDate = challengeByEquipe.get(row.EQUIPE_ID) ?? new Date();
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
