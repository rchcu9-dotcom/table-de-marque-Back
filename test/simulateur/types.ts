export type MatchStatus = 'planned' | 'ongoing' | 'finished';
export type MatchCompetition = '5v5' | '3v3' | 'challenge';
export type SqlScheduleSlot = 'J1_5V5' | 'J2_5V5' | 'J2_3V3' | 'J3_PHASE_1' | 'J3_PHASE_2';

export type SimTeam = {
  id: string;
  name: string;
  group: string;
};

export type SimPlayer = {
  id: string;
  teamId: string;
  name: string;
  qf?: string;
  df?: string;
  f?: string;
  v?: 0 | 1;
};

export type SimMatch = {
  id: string;
  teamAId: string;
  teamBId: string;
  day: 'J1' | 'J2' | 'J3';
  dateTime: string;
  competition: MatchCompetition;
  phase: string;
  group: string;
  teamA: string;
  teamB: string;
  status: MatchStatus;
  scoreA: number;
  scoreB: number;
  forcedWinnerAIfDraw?: boolean;
  slot?: SqlScheduleSlot;
  placeholderA?: string;
  placeholderB?: string;
  lineupResolved?: boolean;
};

export type StandingRow = {
  teamId: string;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type ChallengeAttempt = {
  playerId: string;
  teamId: string;
  atelier: 'vitesse' | 'agilite' | 'tir';
  value: number;
  raw?: string;
  at: string;
};

export type SimEvent = {
  id: string;
  sequence: number;
  type: string;
  at: string;
  payload: Record<string, unknown>;
};

export type WriteAction = {
  table: string;
  action: 'insert' | 'update' | 'delete';
  at?: string;
  where?: string;
  values: Record<string, unknown>;
};

export type SimulationData = {
  teams: SimTeam[];
  dataWarnings: string[];
  sqlLoadDiagnostics?: {
    fiveVFiveSourceRows: number;
    droppedByReason: Record<string, number>;
    keptByDay: Record<'J1' | 'J2' | 'J3', number>;
  };
  players: SimPlayer[];
  matches: SimMatch[];
  standings: Record<string, StandingRow[]>;
  challengeAttempts: ChallengeAttempt[];
  events: SimEvent[];
  writes: WriteAction[];
  challengeStartAudit: Array<{
    teamId: string;
    startAt: string;
    startSource: 'sql' | 'fallback';
    rawSqlValue?: string;
  }>;
  sqlDateRemap?: {
    enabled: boolean;
    sourceTournamentDates: [string, string, string];
    targetTournamentDates: [string, string, string];
    mapping: Record<string, string>;
  };
  runMetrics?: {
    sessionExecutedWrites: number;
    sessionFailedWrites: number;
    sessionRetries: number;
    sessionRowsAffectedByTable: Record<string, number>;
    skippedBecauseAlreadyExecuted: number;
    totalExecutedWritesIncludingCheckpoint: number;
    totalFailedWritesIncludingCheckpoint: number;
    totalRetriesIncludingCheckpoint: number;
    totalRowsAffectedIncludingCheckpoint: Record<string, number>;
    classementUpdateAttempts: number;
    classementUpdateZeroRows: number;
    classementUpsertFallbackCount: number;
    classementRowsDeletedStale: number;
    classementGroupOverflowDetected: number;
    teamsMissingPlayersDetected: number;
    playersInsertedForMissingTeams: number;
    joueursResetRowsAffected: number;
    joueursAtelierWrites: number;
    joueursAtelierWriteFailures: number;
    dynamicLineupPersistAttempts: number;
    dynamicLineupPersistFailures: number;
    dynamicClassementInitAttempts: number;
    dynamicClassementInitFailures: number;
    j3ClassementInitAttempts: number;
    j3ClassementInitFailures: number;
    j3ClassementUpdateAttempts: number;
    j3ClassementUpdateFailures: number;
    executedWrites: number;
    failedWrites: number;
    retries: number;
    rowsAffectedByTable: Record<string, number>;
    runDurationMs: number;
    dbTarget?: string;
    backupFile?: string;
    checkpointUsed: boolean;
  };
};

export type PlannedAction = {
  id: string;
  at: string;
  type: string;
  payload: Record<string, unknown>;
  execute: () => void;
};
