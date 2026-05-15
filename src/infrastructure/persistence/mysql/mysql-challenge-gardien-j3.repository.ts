import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  ChallengeGardienJ3Player,
  ChallengeGardienJ3Repository,
} from '@/domain/challenge/repositories/challenge-gardien-j3.repository';

type TaJoueurRow = {
  ID: number;
  EQUIPE_ID: number;
  NOM: string;
  PRENOM: string;
  GARDIEN_DF: string | null;
  GARDIEN_F: string | null;
  GARDIEN_V: string | null;
};

type TaEquipeRow = {
  ID: number;
  EQUIPE: string;
};

@Injectable()
export class MySqlChallengeGardienJ3Repository
  implements ChallengeGardienJ3Repository
{
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ChallengeGardienJ3Player[]> {
    const [joueurs, equipes] = await Promise.all([
      this.prisma.$queryRaw<TaJoueurRow[]>`
        SELECT ID, EQUIPE_ID, NOM, PRENOM, GARDIEN_DF, GARDIEN_F, GARDIEN_V
        FROM ta_joueurs
        WHERE POSITION = 'G'
      `,
      this.prisma.$queryRaw<TaEquipeRow[]>`
        SELECT ID, EQUIPE FROM ta_equipes
      `,
    ]);

    const equipeNameById = new Map<number, string>();
    equipes.forEach((row) => equipeNameById.set(row.ID, row.EQUIPE));

    return joueurs
      .filter((row) => row.GARDIEN_DF || row.GARDIEN_F || row.GARDIEN_V)
      .map((row) => {
        const equipeName =
          equipeNameById.get(row.EQUIPE_ID) ?? String(row.EQUIPE_ID);
        const displayName =
          `${row.PRENOM ?? ''} ${row.NOM ?? ''}`.trim() || row.NOM;
        return {
          id: String(row.ID),
          name: displayName,
          teamId: String(row.EQUIPE_ID),
          teamName: equipeName,
          df: row.GARDIEN_DF,
          f: row.GARDIEN_F,
          v: row.GARDIEN_V,
        };
      });
  }
}
