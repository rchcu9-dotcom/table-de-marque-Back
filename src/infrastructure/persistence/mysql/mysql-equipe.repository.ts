import { Injectable } from '@nestjs/common';
import {
  Equipe,
  PouleClassement,
  PouleCode,
} from '@/domain/equipe/entities/equipe.entity';
import { EquipeRepository } from '@/domain/equipe/repositories/equipe.repository';
import { PrismaService } from './prisma.service';
import { buildTeamLogoUrl, normalizeKey, pouleDisplayName } from './mysql-utils';

type TaEquipeRow = {
  ID: number;
  EQUIPE: string;
  IMAGE: string | null;
};

type TaClassementRow = {
  GROUPE_NOM: string;
  ORDRE: number;
  EQUIPE: string;
  EQUIPE_ID: number;
  J: number;
  V: number;
  N: number;
  D: number;
  PTS: number;
  BP: number;
  BC: number;
  DIFF: number;
};

@Injectable()
export class MySqlEquipeRepository implements EquipeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findClassementByPoule(
    code: PouleCode,
  ): Promise<PouleClassement | null> {
    const normalized = String(code).trim();
    if (!normalized) return null;
    const [classementRows, equipeRows] = await Promise.all([
      this.prisma.$queryRaw<TaClassementRow[]>`
        SELECT GROUPE_NOM, ORDRE, EQUIPE, EQUIPE_ID, J, V, N, D, PTS, BP, BC, DIFF
        FROM ta_classement
        WHERE GROUPE_NOM = ${normalized}
        ORDER BY ORDRE ASC
      `,
      this.prisma.$queryRaw<TaEquipeRow[]>`
        SELECT ID, EQUIPE, IMAGE FROM ta_equipes
      `,
    ]);

    if (!classementRows.length) return null;

    const pouleName = pouleDisplayName(normalized) ?? normalized;
    const equipes = classementRows.map(
      (row) =>
        new Equipe(
          row.EQUIPE,
          row.EQUIPE,
          buildTeamLogoUrl(row.EQUIPE),
          normalized,
          pouleName,
          row.ORDRE,
          row.J,
          row.V,
          row.N,
          row.D,
          row.PTS,
          row.BP,
          row.BC,
          row.DIFF,
        ),
    );

    return { pouleCode: normalized, pouleName, equipes };
  }

  async findClassementByTeamName(
    teamName: string,
  ): Promise<PouleClassement | null> {
    const target = normalizeKey(teamName);
    const rows = await this.prisma.$queryRaw<TaClassementRow[]>`
      SELECT GROUPE_NOM, ORDRE, EQUIPE, EQUIPE_ID, J, V, N, D, PTS, BP, BC, DIFF
      FROM ta_classement
    `;
    const match = rows.find((row) => normalizeKey(row.EQUIPE) === target);
    if (!match) return null;
    return this.findClassementByPoule(match.GROUPE_NOM);
  }

  async findAllEquipes(): Promise<Equipe[]> {
    const [classementRows, equipeRows] = await Promise.all([
      this.prisma.$queryRaw<TaClassementRow[]>`
        SELECT GROUPE_NOM, ORDRE, EQUIPE, EQUIPE_ID, J, V, N, D, PTS, BP, BC, DIFF
        FROM ta_classement
        ORDER BY GROUPE_NOM ASC, ORDRE ASC
      `,
      this.prisma.$queryRaw<TaEquipeRow[]>`
        SELECT ID, EQUIPE, IMAGE FROM ta_equipes
      `,
    ]);

    const mapped = classementRows.map((row) => {
      const pouleName = pouleDisplayName(row.GROUPE_NOM) ?? row.GROUPE_NOM;
      return new Equipe(
        row.EQUIPE,
        row.EQUIPE,
        buildTeamLogoUrl(row.EQUIPE),
        row.GROUPE_NOM,
        pouleName,
        row.ORDRE,
        row.J,
        row.V,
        row.N,
        row.D,
        row.PTS,
        row.BP,
        row.BC,
        row.DIFF,
      );
    });

    const dedup = new Map<string, Equipe>();
    mapped.forEach((eq) => {
      dedup.set(normalizeKey(eq.id), eq);
    });
    return Array.from(dedup.values());
  }

  async findEquipeById(id: string): Promise<Equipe | null> {
    const target = normalizeKey(id);
    const all = await this.findAllEquipes();
    return (
      all.find((eq) => normalizeKey(eq.id) === target) ??
      all.find((eq) => normalizeKey(eq.name) === target) ??
      null
    );
  }
}
