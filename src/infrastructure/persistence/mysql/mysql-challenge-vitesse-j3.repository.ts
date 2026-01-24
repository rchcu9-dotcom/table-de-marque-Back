import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  ChallengeVitesseJ3Player,
  ChallengeVitesseJ3Repository,
} from '@/domain/challenge/repositories/challenge-vitesse-j3.repository';

type TaJoueurRow = {
  ID: number;
  EQUIPE_ID: number;
  NOM: string;
  PRENOM: string;
  QF: string | null;
  DF: string | null;
  F: string | null;
  V: string | null;
};

type TaEquipeRow = {
  ID: number;
  EQUIPE: string;
};

@Injectable()
export class MySqlChallengeVitesseJ3Repository
  implements ChallengeVitesseJ3Repository
{
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ChallengeVitesseJ3Player[]> {
    const [joueurs, equipes] = await Promise.all([
      this.prisma.$queryRaw<TaJoueurRow[]>`
        SELECT ID, EQUIPE_ID, NOM, PRENOM, QF, DF, F, V
        FROM ta_joueurs
      `,
      this.prisma.$queryRaw<TaEquipeRow[]>`
        SELECT ID, EQUIPE FROM ta_equipes
      `,
    ]);

    const equipeNameById = new Map<number, string>();
    equipes.forEach((row) => equipeNameById.set(row.ID, row.EQUIPE));

    return joueurs.map((row) => {
      const equipeName = equipeNameById.get(row.EQUIPE_ID) ?? String(row.EQUIPE_ID);
      const displayName = `${row.PRENOM ?? ''} ${row.NOM ?? ''}`.trim() || row.NOM;
      return {
        id: String(row.ID),
        name: displayName,
        teamId: String(row.EQUIPE_ID),
        teamName: equipeName,
        qf: row.QF,
        df: row.DF,
        f: row.F,
        v: row.V,
      };
    });
  }
}
