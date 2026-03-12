import { PrismaClient, Prisma } from '@prisma/client';
import type { WriteAction } from '../types';

export type SqlApplyResult = {
  attempted: number;
  succeeded: number;
  failed: number;
  retries: number;
  rowsAffectedByTable: Record<string, number>;
  classementUpdateAttempts: number;
  classementUpdateZeroRows: number;
  classementUpsertFallbackCount: number;
  classementRowsDeletedStale: number;
  classementGroupOverflowDetected: number;
  classementWriteTraces: Array<{
    triggerMatchId: string | null;
    teamId: string;
    jour: string;
    groupeNom: string;
    rowsAffected: number;
    mode: 'update' | 'upsert_fallback';
  }>;
  classementOverflowTraces: Array<{
    jour: string;
    groupeNom: string;
    rowCount: number;
  }>;
  joueursAtelierWrites: number;
  joueursAtelierWriteFailures: number;
  joueurAtelierTraces: Array<{
    playerId: string;
    teamId: string | null;
    rowsAffected: number;
  }>;
  dynamicLineupPersistAttempts: number;
  dynamicLineupPersistFailures: number;
  dynamicLineupTraces: Array<{
    matchId: string;
    numMatch: number | null;
    day: string;
    group: string;
    rowsAffected: number;
  }>;
  dynamicClassementInitAttempts: number;
  dynamicClassementInitFailures: number;
  j3ClassementInitAttempts: number;
  j3ClassementInitFailures: number;
  j3ClassementUpdateAttempts: number;
  j3ClassementUpdateFailures: number;
};

function parseQuoted(where: string | undefined, key: string): string | null {
  if (!where) return null;
  const regex = new RegExp(`${key}='([^']*)'`, 'i');
  const m = where.match(regex);
  return m ? m[1] : null;
}

function parseMatchNum(where: string | undefined): number | null {
  const numFromNumMatch = parseQuoted(where, 'NUM_MATCH');
  if (numFromNumMatch) {
    const parsed = Number(numFromNumMatch);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const id = parseQuoted(where, 'ID');
  if (!id) return null;
  if (id.startsWith('M-')) {
    const parsed = Number(id.slice(2));
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : null;
}

function toClassementGroup(groupRaw: string): string | null {
  const normalized = groupRaw.trim();
  if (/^[ABCD1234EFGH]$/i.test(normalized)) return normalized.toUpperCase();
  return null;
}

export class SqlWriter {
  private prisma: PrismaClient | null = null;
  private dbName: string | null = null;

  constructor(private readonly opts?: { allowProd?: boolean }) {}

  private getClient(): PrismaClient {
    if (!this.prisma) {
      this.prisma = new PrismaClient();
    }
    return this.prisma;
  }

  async connect(): Promise<void> {
    await this.getClient().$connect();
    await this.assertTargetSafety();
  }

  async disconnect(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }
  }

  private async assertTargetSafety(): Promise<void> {
    const dbNameRows = await this.getClient().$queryRaw<Array<{ db: string }>>(Prisma.sql`SELECT DATABASE() AS db`);
    const dbName = dbNameRows[0]?.db ?? '';
    this.dbName = dbName;
    const isTestTarget = /test/i.test(dbName);
    if (!isTestTarget && !this.opts?.allowProd) {
      throw new Error(`Run blocked: target database is '${dbName}', use --allowProd to override.`);
    }
  }

  getDbTarget(): string {
    return this.dbName ?? 'unknown';
  }

  async executeActionWrites(writes: WriteAction[]): Promise<SqlApplyResult> {
    if (writes.length === 0) {
      return {
        attempted: 0,
        succeeded: 0,
        failed: 0,
        retries: 0,
        rowsAffectedByTable: {},
        classementUpdateAttempts: 0,
        classementUpdateZeroRows: 0,
        classementUpsertFallbackCount: 0,
        classementRowsDeletedStale: 0,
        classementGroupOverflowDetected: 0,
        classementWriteTraces: [],
        classementOverflowTraces: [],
        joueursAtelierWrites: 0,
        joueursAtelierWriteFailures: 0,
        joueurAtelierTraces: [],
        dynamicLineupPersistAttempts: 0,
        dynamicLineupPersistFailures: 0,
        dynamicLineupTraces: [],
        dynamicClassementInitAttempts: 0,
        dynamicClassementInitFailures: 0,
        j3ClassementInitAttempts: 0,
        j3ClassementInitFailures: 0,
        j3ClassementUpdateAttempts: 0,
        j3ClassementUpdateFailures: 0,
      };
    }

    const result: SqlApplyResult = {
      attempted: writes.length,
      succeeded: 0,
      failed: 0,
      retries: 0,
      rowsAffectedByTable: {},
      classementUpdateAttempts: 0,
      classementUpdateZeroRows: 0,
      classementUpsertFallbackCount: 0,
      classementRowsDeletedStale: 0,
      classementGroupOverflowDetected: 0,
      classementWriteTraces: [],
      classementOverflowTraces: [],
      joueursAtelierWrites: 0,
      joueursAtelierWriteFailures: 0,
      joueurAtelierTraces: [],
      dynamicLineupPersistAttempts: 0,
      dynamicLineupPersistFailures: 0,
      dynamicLineupTraces: [],
      dynamicClassementInitAttempts: 0,
      dynamicClassementInitFailures: 0,
      j3ClassementInitAttempts: 0,
      j3ClassementInitFailures: 0,
      j3ClassementUpdateAttempts: 0,
      j3ClassementUpdateFailures: 0,
    };

    await this.getClient().$transaction(async (tx) => {
      for (const write of writes) {
        const applied = await this.applyWrite(tx, write);
        const atelierFailed = applied.joueurAtelierTrace?.rowsAffected === 0;
        if (atelierFailed) {
          result.failed += 1;
        } else {
          result.succeeded += 1;
        }
        result.rowsAffectedByTable[write.table] = (result.rowsAffectedByTable[write.table] ?? 0) + applied.rows;
        if (applied.classementTrace) {
          result.classementUpdateAttempts += 1;
          if (applied.classementTrace.mode === 'upsert_fallback') {
            result.classementUpdateZeroRows += 1;
            result.classementUpsertFallbackCount += 1;
          }
          result.classementWriteTraces.push(applied.classementTrace);
          result.classementRowsDeletedStale += applied.classementRowsDeletedStale ?? 0;
          if (applied.classementOverflowTrace) {
            result.classementGroupOverflowDetected += 1;
            result.classementOverflowTraces.push(applied.classementOverflowTrace);
          }
        }
        if (applied.joueurAtelierTrace) {
          result.joueurAtelierTraces.push(applied.joueurAtelierTrace);
          if (applied.joueurAtelierTrace.rowsAffected > 0) {
            result.joueursAtelierWrites += 1;
          } else {
            result.joueursAtelierWriteFailures += 1;
          }
        }
        if (applied.dynamicLineupTrace) {
          result.dynamicLineupPersistAttempts += 1;
          result.dynamicLineupTraces.push(applied.dynamicLineupTrace);
          if (applied.dynamicLineupTrace.rowsAffected === 0) {
            result.dynamicLineupPersistFailures += 1;
          }
        }
        if (applied.dynamicClassementInitAttempt === true) {
          result.dynamicClassementInitAttempts += 1;
          if (applied.dynamicClassementInitFailed === true) {
            result.dynamicClassementInitFailures += 1;
          }
        }
        if (applied.dynamicJ3ClassementInitAttempt === true) {
          result.j3ClassementInitAttempts += 1;
          if (applied.dynamicJ3ClassementInitFailed === true) {
            result.j3ClassementInitFailures += 1;
          }
        }
        if (applied.dynamicJ3ClassementUpdateAttempt === true) {
          result.j3ClassementUpdateAttempts += 1;
          if (applied.dynamicJ3ClassementUpdateFailed === true) {
            result.j3ClassementUpdateFailures += 1;
          }
        }
      }
    });

    return result;
  }

  private async applyWrite(
    tx: Prisma.TransactionClient,
    write: WriteAction,
  ): Promise<{
    rows: number;
    classementTrace?: {
      triggerMatchId: string | null;
      teamId: string;
      jour: string;
      groupeNom: string;
      rowsAffected: number;
      mode: 'update' | 'upsert_fallback';
    };
    classementRowsDeletedStale?: number;
    classementOverflowTrace?: {
      jour: string;
      groupeNom: string;
      rowCount: number;
    };
    joueurAtelierTrace?: {
      playerId: string;
      teamId: string | null;
      rowsAffected: number;
    };
    dynamicLineupTrace?: {
      matchId: string;
      numMatch: number | null;
      day: string;
      group: string;
      rowsAffected: number;
    };
    dynamicClassementInitAttempt?: boolean;
    dynamicClassementInitFailed?: boolean;
    dynamicJ3ClassementInitAttempt?: boolean;
    dynamicJ3ClassementInitFailed?: boolean;
    dynamicJ3ClassementUpdateAttempt?: boolean;
    dynamicJ3ClassementUpdateFailed?: boolean;
  }> {
    switch (write.table.toLowerCase()) {
      case 'ta_matchs':
        {
          const rows = await this.applyMatchWrite(tx, write);
          const isDynamicLineup = write.values.__IS_DYNAMIC_LINEUP === true;
          if (!isDynamicLineup) {
            return { rows };
          }
          const matchId = typeof write.values.__MATCH_ID === 'string' ? write.values.__MATCH_ID : parseQuoted(write.where, 'ID') ?? '';
          const day = typeof write.values.__DAY === 'string' ? write.values.__DAY : '';
          const group = typeof write.values.__GROUP === 'string' ? write.values.__GROUP : '';
          const numMatch = parseMatchNum(write.where);
          return {
            rows,
            dynamicLineupTrace: {
              matchId,
              numMatch,
              day,
              group,
              rowsAffected: rows,
            },
          };
        }
      case 'ta_equipes':
        return { rows: await this.applyEquipeWrite(tx, write) };
      case 'ta_challenge_attempts':
        // Legacy optional table: no-op by default, official atelier persistence is ta_joueurs.
        return { rows: 0 };
      case 'ta_classement':
        return this.applyClassementWrite(tx, write);
      case 'ta_joueurs':
        return this.applyJoueurWrite(tx, write);
      default:
        throw new Error(`Unsupported table for run mode: ${write.table}`);
    }
  }

  private async applyMatchWrite(tx: Prisma.TransactionClient, write: WriteAction): Promise<number> {
    const matchNum = parseMatchNum(write.where);
    if (matchNum === null) {
      throw new Error(`Cannot resolve NUM_MATCH from where clause: ${write.where ?? '<empty>'}`);
    }

    const columnMap: Array<[string, string]> = [
      ['ETAT', 'ETAT'],
      ['SCORE_EQUIPE1', 'SCORE1'],
      ['SCORE_EQUIPE2', 'SCORE2'],
      ['EQUIPE1', 'EQUIPE1'],
      ['EQUIPE2', 'EQUIPE2'],
      ['EQUIPE_ID1', 'EQUIPE_ID1'],
      ['EQUIPE_ID2', 'EQUIPE_ID2'],
      ['DATEHEURE', 'DATEHEURE'],
    ];

    const setParts: string[] = [];
    const args: Array<string | number | null> = [];
    for (const [inputKey, dbColumn] of columnMap) {
      if (!(inputKey in write.values)) continue;
      setParts.push(`${dbColumn} = ?`);
      const raw = write.values[inputKey];
      args.push(raw == null ? null : (raw as string | number));
    }

    if (setParts.length === 0) {
      return 0;
    }

    const rows = await tx.$executeRawUnsafe(
      `UPDATE TA_MATCHS SET ${setParts.join(', ')} WHERE NUM_MATCH = ?`,
      ...args,
      matchNum,
    );

    return Number(rows);
  }

  private async applyEquipeWrite(tx: Prisma.TransactionClient, write: WriteAction): Promise<number> {
    const id = parseQuoted(write.where, 'ID');
    if (!id) {
      throw new Error(`Invalid equipe where clause: ${write.where ?? '<empty>'}`);
    }

    const setParts: string[] = [];
    const values: Array<string | number | null> = [];
    if ('CHALLENGE_SAMEDI' in write.values) {
      setParts.push('CHALLENGE_SAMEDI = ?');
      const raw = write.values.CHALLENGE_SAMEDI;
      values.push(raw == null ? null : (raw as string | number));
    }

    if (setParts.length === 0) {
      return 0;
    }

    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new Error(`Invalid equipe ID in where clause: ${write.where ?? '<empty>'}`);
    }

    const rows = await tx.$executeRawUnsafe(
      `UPDATE ta_equipes SET ${setParts.join(', ')} WHERE ID = ?`,
      ...values,
      numericId,
    );

    return Number(rows);
  }

  private async applyClassementWrite(
    tx: Prisma.TransactionClient,
    write: WriteAction,
  ): Promise<{
    rows: number;
    classementTrace: {
      triggerMatchId: string | null;
      teamId: string;
      jour: string;
      groupeNom: string;
      rowsAffected: number;
      mode: 'update' | 'upsert_fallback';
    };
    classementRowsDeletedStale: number;
    classementOverflowTrace?: {
      jour: string;
      groupeNom: string;
      rowCount: number;
    };
    dynamicClassementInitAttempt: boolean;
    dynamicClassementInitFailed: boolean;
    dynamicJ3ClassementInitAttempt: boolean;
    dynamicJ3ClassementInitFailed: boolean;
    dynamicJ3ClassementUpdateAttempt: boolean;
    dynamicJ3ClassementUpdateFailed: boolean;
  }> {
    const jour = parseQuoted(write.where, 'JOUR') ?? String(write.values.JOUR ?? '');
    const groupeNom = parseQuoted(write.where, 'GROUPE_NOM');
    const equipeId = parseQuoted(write.where, 'EQUIPE_ID');
    if (!groupeNom || !equipeId) {
      throw new Error(`Invalid classement where clause: ${write.where ?? '<empty>'}`);
    }
    const dynamicClassementInitAttempt = write.values.__IS_DYNAMIC_CLASSEMENT_INIT === true;
    const dynamicJ3ClassementInitAttempt =
      write.values.__IS_DYNAMIC_J3_CLASSEMENT_INIT === true;
    const dynamicJ3ClassementUpdateAttempt =
      write.values.__IS_DYNAMIC_J3_CLASSEMENT_UPDATE === true;
    const dbGroup = toClassementGroup(groupeNom);
    if (!dbGroup) {
      const triggerMatchId = typeof write.values.__TRIGGER_MATCH_ID === 'string' ? write.values.__TRIGGER_MATCH_ID : null;
      return {
        rows: 0,
        classementTrace: {
          triggerMatchId,
          teamId: equipeId,
          jour,
          groupeNom,
          rowsAffected: 0,
          mode: 'update',
        },
        classementRowsDeletedStale: 0,
        dynamicClassementInitAttempt,
        dynamicClassementInitFailed: dynamicClassementInitAttempt,
        dynamicJ3ClassementInitAttempt,
        dynamicJ3ClassementInitFailed: dynamicJ3ClassementInitAttempt,
        dynamicJ3ClassementUpdateAttempt,
        dynamicJ3ClassementUpdateFailed: dynamicJ3ClassementUpdateAttempt,
      };
    }
    const ordre = Number(write.values.ORDRE ?? 0);
    if (!Number.isFinite(ordre) || ordre <= 0) {
      throw new Error(`Invalid classement rank ORDRE for ${groupeNom}/${equipeId}: ${String(write.values.ORDRE)}`);
    }

    const points = Number(write.values.POINTS ?? 0);
    const played = Number(write.values.MATCHS_JOUES ?? 0);
    const wins = Number(write.values.VICTOIRES ?? 0);
    const draws = Number(write.values.NULS ?? 0);
    const losses = Number(write.values.DEFAITES ?? 0);
    const goalsFor = Number(write.values.BUTS_POUR ?? 0);
    const goalsAgainst = Number(write.values.BUTS_CONTRE ?? 0);
    const diff = goalsFor - goalsAgainst;

    const rows = await tx.$executeRawUnsafe(
      'UPDATE ta_classement SET J = ?, V = ?, N = ?, D = ?, PTS = ?, BP = ?, BC = ?, DIFF = ? WHERE GROUPE_NOM = ? AND EQUIPE_ID = ?',
      played,
      wins,
      draws,
      losses,
      points,
      goalsFor,
      goalsAgainst,
      diff,
      dbGroup,
      Number(equipeId),
    );

    const triggerMatchId = typeof write.values.__TRIGGER_MATCH_ID === 'string' ? write.values.__TRIGGER_MATCH_ID : null;
    let mode: 'update' | 'upsert_fallback' = 'update';
    let writeRows = Number(rows);

    if (writeRows === 0) {
      mode = 'upsert_fallback';
      const fallbackEquipeName = String(write.values.EQUIPE ?? '');
      const upsertRows = await tx.$executeRawUnsafe(
        `INSERT INTO ta_classement (GROUPE_NOM, ORDRE, ORDRE_FINAL, EQUIPE, EQUIPE_ID, J, V, N, D, PTS, BP, BC, DIFF)
         VALUES (?, ?, ?, COALESCE((SELECT EQUIPE FROM ta_equipes WHERE ID = ? LIMIT 1), ?), ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           EQUIPE = VALUES(EQUIPE), EQUIPE_ID = VALUES(EQUIPE_ID),
           J = VALUES(J), V = VALUES(V), N = VALUES(N), D = VALUES(D),
           PTS = VALUES(PTS), BP = VALUES(BP), BC = VALUES(BC), DIFF = VALUES(DIFF)`,
        dbGroup,
        ordre,
        ordre,
        Number(equipeId),
        fallbackEquipeName,
        Number(equipeId),
        played,
        wins,
        draws,
        losses,
        points,
        goalsFor,
        goalsAgainst,
        diff,
      );
      writeRows = Number(upsertRows);
    }

    const isCleanupWrite = Boolean(write.values.__GROUP_CLEANUP_LAST);
    let staleDeleted = 0;
    let overflowTrace: { jour: string; groupeNom: string; rowCount: number } | undefined;
    if (isCleanupWrite) {
      const activeSize = Number(write.values.__ACTIVE_GROUP_SIZE ?? 0);
      if (Number.isFinite(activeSize) && activeSize > 0) {
        const deleted = await tx.$executeRawUnsafe(
          'DELETE FROM ta_classement WHERE GROUPE_NOM = ? AND ORDRE > ?',
          dbGroup,
          activeSize,
        );
        staleDeleted = Number(deleted);
      }

      const isTournamentGroup = /^[ABCD1234EFGH]$/.test(dbGroup);
      const isTournamentDay = jour === 'J1' || jour === 'J2' || jour === 'J3';
      if (isTournamentGroup && isTournamentDay) {
        const rowsInGroup = await tx.$queryRawUnsafe<Array<{ c: number }>>(
          'SELECT COUNT(*) AS c FROM ta_classement WHERE GROUPE_NOM = ?',
          dbGroup,
        );
        const rowCount = Number(rowsInGroup[0]?.c ?? 0);
        if (rowCount > 4) {
          overflowTrace = { jour, groupeNom: dbGroup, rowCount };
        }
      }
    }

    return {
      rows: writeRows + staleDeleted,
      classementTrace: {
        triggerMatchId,
        teamId: equipeId,
        jour,
        groupeNom: dbGroup,
        rowsAffected: writeRows,
        mode,
      },
      classementRowsDeletedStale: staleDeleted,
      classementOverflowTrace: overflowTrace,
      dynamicClassementInitAttempt,
      dynamicClassementInitFailed: dynamicClassementInitAttempt && writeRows === 0,
      dynamicJ3ClassementInitAttempt,
      dynamicJ3ClassementInitFailed: dynamicJ3ClassementInitAttempt && writeRows === 0,
      dynamicJ3ClassementUpdateAttempt,
      dynamicJ3ClassementUpdateFailed: dynamicJ3ClassementUpdateAttempt && writeRows === 0,
    };
  }

  private async applyJoueurWrite(
    tx: Prisma.TransactionClient,
    write: WriteAction,
  ): Promise<{
    rows: number;
    joueurAtelierTrace?: {
      playerId: string;
      teamId: string | null;
      rowsAffected: number;
    };
  }> {
    const id = parseQuoted(write.where, 'ID');
    if (!id) {
      throw new Error(`Invalid joueur where clause: ${write.where ?? '<empty>'}`);
    }

    const allowedColumns = [
      'QF',
      'DF',
      'F',
      'V',
      'TEMPS_SLALOM',
      'TIME_SLALOM',
      'NB_PORTES',
      'TEMPS_VITESSE',
      'TIME_VITESSE',
      'TIR1',
      'TIR2',
      'TIR3',
      'TEMPS_TOTAL',
      'TIME_TOTAL',
      'GARDIEN_TEMPS_ATELIER',
      'GARDIEN_TIME_ATELIER',
      'GARDIEN_TEMPS_VITESSE',
      'GARDIEN_TIME_VITESSE',
      'GARDIEN_TEMPS_TOTAL',
      'GARDIEN_TIME_TOTAL',
      'GARDIEN_NB_BUT',
      'GARDIEN_DF',
      'GARDIEN_F',
      'GARDIEN_V',
    ] as const;

    const setParts: string[] = [];
    const values: Array<string | number | null> = [];
    for (const column of allowedColumns) {
      if (!(column in write.values)) continue;
      setParts.push(`${column} = ?`);
      const raw = write.values[column];
      values.push(raw == null ? null : (raw as string | number));
    }

    if (setParts.length === 0) {
      return { rows: 0 };
    }

    const isAtelierWrite =
      write.values.__IS_ATELIER_WRITE === true ||
      'TIME_SLALOM' in write.values ||
      'TIME_VITESSE' in write.values ||
      'TIME_TOTAL' in write.values ||
      'TIR1' in write.values ||
      'TIR2' in write.values ||
      'TIR3' in write.values;

    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      if (!isAtelierWrite) {
        return { rows: 0 };
      }
      const teamId = write.values.__TEAM_ID == null ? null : String(write.values.__TEAM_ID);
      return {
        rows: 0,
        joueurAtelierTrace: {
          playerId: String(id),
          teamId,
          rowsAffected: 0,
        },
      };
    }

    const rows = await tx.$executeRawUnsafe(
      `UPDATE ta_joueurs SET ${setParts.join(', ')} WHERE ID = ?`,
      ...values,
      numericId,
    );

    if (!isAtelierWrite) {
      return { rows: Number(rows) };
    }

    const teamId = write.values.__TEAM_ID == null ? null : String(write.values.__TEAM_ID);
    return {
      rows: Number(rows),
      joueurAtelierTrace: {
        playerId: String(id),
        teamId,
        rowsAffected: Number(rows),
      },
    };
  }
}
