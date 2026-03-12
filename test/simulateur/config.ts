import path from 'node:path';

export type SimulationMode = 'dry-run' | 'run';
export type TimeMode = 'realtime' | 'accelerated' | 'immediate';
export type ResetMode = 'pre-tournament' | 'none';
export type ScheduleMode = 'sql' | 'dynamic';

export type SimulatorConfig = {
  mode: SimulationMode;
  day1Date: string;
  day2Date: string;
  day3Date: string;
  timeMode: TimeMode;
  timeScale: number;
  matchDurationMin: number;
  interMatchBreakMin: number;
  challengeDay1StartTime: string;
  sqlDumpPath: string;
  seed: number;
  reportDir: string;
  reset: ResetMode;
  backupFile?: string;
  resumeFrom?: string;
  checkpointEvery: number;
  confirmRun: boolean;
  allowProd: boolean;
  remapSqlDates: boolean;
  scheduleMode: ScheduleMode;
  interruptAfterActions?: number;
};

function readArg(args: string[], key: string): string | undefined {
  const idx = args.indexOf(key);
  if (idx < 0) return undefined;
  return args[idx + 1];
}

function hasFlag(args: string[], key: string): boolean {
  return args.includes(key);
}

function requireDate(value: string | undefined, key: string): string {
  if (!value) throw new Error(`Missing required argument ${key}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date format for ${key}. Expected YYYY-MM-DD`);
  }
  return value;
}

function parseIntArg(value: string | undefined, fallback: number, key: string): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${key}: ${value}`);
  }
  return parsed;
}

function parseTimeOfDay(value: string | undefined, fallback: string, key: string): string {
  const resolved = value ?? fallback;
  if (!/^\d{2}:\d{2}$/.test(resolved)) {
    throw new Error(`Invalid time format for ${key}. Expected HH:mm`);
  }
  return resolved;
}

function parseMode(value: string | undefined): SimulationMode {
  if (!value) return 'dry-run';
  if (value === 'dry-run' || value === 'run') return value;
  throw new Error(`Invalid --mode ${value}`);
}

function parseTimeMode(value: string | undefined): TimeMode {
  if (!value) return 'realtime';
  if (value === 'realtime' || value === 'accelerated' || value === 'immediate') return value;
  throw new Error(`Invalid --timeMode ${value}`);
}

function parseReset(value: string | undefined, mode: SimulationMode): ResetMode {
  if (!value) return mode === 'run' ? 'pre-tournament' : 'none';
  if (value === 'pre-tournament' || value === 'none') return value;
  throw new Error(`Invalid --reset ${value}`);
}

function parseBooleanArg(value: string | undefined, fallback: boolean, key: string): boolean {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error(`Invalid boolean value for ${key}: ${value}. Expected true|false`);
}

function parseScheduleMode(value: string | undefined): ScheduleMode {
  if (!value) return 'dynamic';
  if (value === 'sql' || value === 'dynamic') return value;
  throw new Error(`Invalid --scheduleMode ${value}`);
}

export function parseConfig(argv: string[]): SimulatorConfig {
  const mode = parseMode(readArg(argv, '--mode'));
  const day1Date = requireDate(readArg(argv, '--day1Date'), '--day1Date');
  const day2Date = requireDate(readArg(argv, '--day2Date'), '--day2Date');
  const day3Date = requireDate(readArg(argv, '--day3Date'), '--day3Date');
  const timeMode = parseTimeMode(readArg(argv, '--timeMode'));
  const timeScale = parseIntArg(readArg(argv, '--timeScale'), 60, '--timeScale');
  const matchDurationMin = parseIntArg(readArg(argv, '--matchDurationMin'), 22, '--matchDurationMin');
  const interMatchBreakMin = parseIntArg(readArg(argv, '--interMatchBreakMin'), 5, '--interMatchBreakMin');
  const challengeDay1StartTime = parseTimeOfDay(
    readArg(argv, '--challengeDay1StartTime'),
    '09:30',
    '--challengeDay1StartTime',
  );
  const sqlDumpPath =
    readArg(argv, '--sqlDumpPath') ??
    path.join(process.cwd(), 'prisma', 'seed-tournoi-2026.sql');
  const seed = parseIntArg(readArg(argv, '--seed'), 20260523, '--seed');
  const checkpointEvery = parseIntArg(readArg(argv, '--checkpointEvery'), 50, '--checkpointEvery');
  const reset = parseReset(readArg(argv, '--reset'), mode);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultOut = path.join(process.cwd(), 'test', 'simulateur', 'out', stamp);
  const reportDir = readArg(argv, '--reportDir') ?? defaultOut;
  const backupFile = readArg(argv, '--backupFile');
  const resumeFrom = readArg(argv, '--resumeFrom');
  const confirmRun = readArg(argv, '--confirmRun') === 'yes';
  const allowProd = hasFlag(argv, '--allowProd');
  const remapSqlDates = parseBooleanArg(readArg(argv, '--remapSqlDates'), false, '--remapSqlDates');
  const scheduleMode = parseScheduleMode(readArg(argv, '--scheduleMode'));
  const interruptAfterActions = parseIntArg(readArg(argv, '--interruptAfterActions'), 0, '--interruptAfterActions');

  if (mode === 'run' && !backupFile) {
    throw new Error('Mode run requires --backupFile');
  }
  if (mode === 'run' && !confirmRun) {
    throw new Error('Mode run requires --confirmRun yes');
  }

  const d1 = new Date(`${day1Date}T00:00:00.000Z`).getTime();
  const d2 = new Date(`${day2Date}T00:00:00.000Z`).getTime();
  const d3 = new Date(`${day3Date}T00:00:00.000Z`).getTime();
  if (!(d1 < d2 && d2 < d3)) {
    throw new Error('Invalid day order: expected day1Date < day2Date < day3Date');
  }

  if (timeMode === 'accelerated' && timeScale <= 0) {
    throw new Error('Invalid --timeScale: must be > 0 in accelerated mode');
  }
  if (matchDurationMin <= 0) {
    throw new Error('Invalid --matchDurationMin: must be > 0');
  }
  if (interMatchBreakMin < 0) {
    throw new Error('Invalid --interMatchBreakMin: must be >= 0');
  }
  if (checkpointEvery < 0) {
    throw new Error('Invalid --checkpointEvery: must be >= 0');
  }
  if (interruptAfterActions < 0) {
    throw new Error('Invalid --interruptAfterActions: must be >= 0');
  }

  if (timeMode !== 'accelerated' && hasFlag(argv, '--timeScale')) {
    // Accepted but ignored unless accelerated.
  }

  return {
    mode,
    day1Date,
    day2Date,
    day3Date,
    timeMode,
    timeScale,
    matchDurationMin,
    interMatchBreakMin,
    challengeDay1StartTime,
    sqlDumpPath,
    seed,
    reportDir,
    reset,
    backupFile,
    resumeFrom,
    checkpointEvery,
    confirmRun,
    allowProd,
    remapSqlDates,
    scheduleMode,
    interruptAfterActions: interruptAfterActions > 0 ? interruptAfterActions : undefined,
  };
}

export function usageText(): string {
  return [
    'Usage:',
    '  pnpm simul-tournoi -- --mode dry-run --day1Date YYYY-MM-DD --day2Date YYYY-MM-DD --day3Date YYYY-MM-DD [options]',
    '',
    'Required:',
    '  --day1Date, --day2Date, --day3Date',
    '',
    'Options:',
    '  --mode dry-run|run (default: dry-run)',
    '  --timeMode realtime|accelerated|immediate (default: realtime)',
    '  --timeScale <number> (accelerated only, default: 60)',
    '  --matchDurationMin <number> (default: 22)',
    '  --interMatchBreakMin <number> (default: 5)',
    '  --challengeDay1StartTime <HH:mm> (fallback default: 09:30)',
    '  --sqlDumpPath <path> (default: prisma/seed-tournoi-2026.sql relative to cwd)',
    '  --seed <int> (default: 20260523)',
    '  --reportDir <path> (default: test/simulateur/out/<timestamp>)',
    '  --reset pre-tournament|none (default: pre-tournament in run)',
    '  --backupFile <path> (required if mode=run)',
    '  --confirmRun yes (required if mode=run)',
    '  --allowProd (explicitly allow non-test DB target)',
    '  --remapSqlDates true|false (default: false)',
    '  --scheduleMode sql|dynamic (default: dynamic)',
    '  --resumeFrom <checkpoint.json>',
    '  --checkpointEvery <n> (default: 50, 0 disables periodic checkpoints)',
    '  --interruptAfterActions <n> (test helper to simulate crash/restart)',
  ].join('\n');
}
