import { Injectable } from '@nestjs/common';
import {
  Equipe,
  PouleClassement,
  PouleCode,
} from '@/domain/equipe/entities/equipe.entity';
import { EquipeRepository } from '@/domain/equipe/repositories/equipe.repository';
import { PrismaService } from './prisma.service';
import {
  buildTeamLogoUrl,
  buildTeamPhotoUrl,
  normalizeKey,
  pouleDisplayName,
  toClassementDbGroupCode,
  toUiPouleCode,
} from './mysql-utils';

type TaEquipeRow = {
  ID: number;
  EQUIPE: string;
  IMAGE: string | null;
  PHOTO: string | null;
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
  REPAS_SAMEDI: string | null;
  REPAS_DIMANCHE: string | null;
  CHALLENGE_SAMEDI: string | null;
};

@Injectable()
export class MySqlEquipeRepository implements EquipeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findClassementByPoule(
    code: PouleCode,
  ): Promise<PouleClassement | null> {
    const normalized = String(code).trim();
    if (!normalized) return null;
    const dbCode = toClassementDbGroupCode(normalized);
    if (!dbCode) return null;
    const uiCode = toUiPouleCode(normalized) ?? normalized;
    const isJ3FinalSquare = ['I', 'J', 'K', 'L'].includes(uiCode);
    const [classementRows, equipeRows] = await Promise.all([
      this.prisma.$queryRaw<TaClassementRow[]>`
        SELECT GROUPE_NOM, ORDRE, EQUIPE, EQUIPE_ID, J, V, N, D, PTS, BP, BC, DIFF,
          DATE_FORMAT(REPAS_SAMEDI, '%Y-%m-%dT%H:%i:%s') AS REPAS_SAMEDI,
          DATE_FORMAT(REPAS_DIMANCHE, '%Y-%m-%dT%H:%i:%s') AS REPAS_DIMANCHE,
          DATE_FORMAT(CHALLENGE_SAMEDI, '%Y-%m-%dT%H:%i:%s') AS CHALLENGE_SAMEDI
        FROM ta_classement
        WHERE GROUPE_NOM = ${dbCode}
        ORDER BY PTS DESC, DIFF DESC, BP DESC, EQUIPE_ID ASC
      `,
      this.prisma.$queryRaw<TaEquipeRow[]>`
        SELECT ID, EQUIPE, IMAGE, PHOTO
        FROM ta_equipes
      `,
    ]);

    if (!classementRows.length) return null;
    const sortedRows = [...classementRows].sort((a, b) => {
      if (isJ3FinalSquare && a.ORDRE !== b.ORDRE) return a.ORDRE - b.ORDRE;
      if (b.PTS !== a.PTS) return b.PTS - a.PTS;
      if (b.DIFF !== a.DIFF) return b.DIFF - a.DIFF;
      if (b.BP !== a.BP) return b.BP - a.BP;
      return a.EQUIPE_ID - b.EQUIPE_ID;
    });

    const equipeByName = new Map(
      equipeRows.map((r) => [normalizeKey(r.EQUIPE), r]),
    );

    const pouleName = pouleDisplayName(uiCode) ?? uiCode;
    const equipes = sortedRows.map(
      (row, index) => {
        const eq = equipeByName.get(normalizeKey(row.EQUIPE));
        return new Equipe(
          row.EQUIPE,
          row.EQUIPE,
          buildTeamLogoUrl(row.EQUIPE),
          uiCode,
          pouleName,
          isJ3FinalSquare ? row.ORDRE : index + 1,
          row.J,
          row.V,
          row.N,
          row.D,
          row.PTS,
          row.BP,
          row.BC,
          row.DIFF,
          row.REPAS_SAMEDI ?? null,
          row.REPAS_DIMANCHE ?? null,
          row.CHALLENGE_SAMEDI ?? null,
          buildTeamPhotoUrl(eq?.PHOTO ?? null),
        );
      },
    );

    return { pouleCode: uiCode, pouleName, equipes };
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
        SELECT GROUPE_NOM, ORDRE, EQUIPE, EQUIPE_ID, J, V, N, D, PTS, BP, BC, DIFF,
          DATE_FORMAT(REPAS_SAMEDI, '%Y-%m-%dT%H:%i:%s') AS REPAS_SAMEDI,
          DATE_FORMAT(REPAS_DIMANCHE, '%Y-%m-%dT%H:%i:%s') AS REPAS_DIMANCHE,
          DATE_FORMAT(CHALLENGE_SAMEDI, '%Y-%m-%dT%H:%i:%s') AS CHALLENGE_SAMEDI
        FROM ta_classement
        WHERE GROUPE_NOM IN ('A', 'B', 'C', 'D')
        ORDER BY GROUPE_NOM ASC, PTS DESC, DIFF DESC, BP DESC, EQUIPE_ID ASC
      `,
      this.prisma.$queryRaw<TaEquipeRow[]>`
        SELECT ID, EQUIPE, IMAGE, PHOTO
        FROM ta_equipes
      `,
    ]);

    const equipeByName = new Map(
      equipeRows.map((r) => [normalizeKey(r.EQUIPE), r]),
    );

    const sortedRows = [...classementRows].sort((a, b) => {
      const groupCmp = String(a.GROUPE_NOM).localeCompare(String(b.GROUPE_NOM), 'fr-FR');
      if (groupCmp !== 0) return groupCmp;
      if (b.PTS !== a.PTS) return b.PTS - a.PTS;
      if (b.DIFF !== a.DIFF) return b.DIFF - a.DIFF;
      if (b.BP !== a.BP) return b.BP - a.BP;
      return a.EQUIPE_ID - b.EQUIPE_ID;
    });

    const mapped = sortedRows.map((row) => {
      const uiCode = toUiPouleCode(row.GROUPE_NOM) ?? row.GROUPE_NOM;
      const pouleName = pouleDisplayName(uiCode) ?? uiCode;
      const eq = equipeByName.get(normalizeKey(row.EQUIPE));
      return new Equipe(
        row.EQUIPE,
        row.EQUIPE,
        buildTeamLogoUrl(row.EQUIPE),
        uiCode,
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
        row.REPAS_SAMEDI ?? null,
        row.REPAS_DIMANCHE ?? null,
        row.CHALLENGE_SAMEDI ?? null,
        buildTeamPhotoUrl(eq?.PHOTO ?? null),
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
