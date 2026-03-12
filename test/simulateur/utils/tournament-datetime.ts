const TOURNAMENT_TZ = 'Europe/Paris';

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function parseParts(sqlDateTime: string): WallClock {
  const match = sqlDateTime.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid SQL datetime format: ${sqlDateTime}`);
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
  };
}

function parseDateTimeParts(sqlDateTime: string): { date: string; time: string } {
  const match = sqlDateTime.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
  if (!match) {
    throw new Error(`Invalid SQL datetime format: ${sqlDateTime}`);
  }
  return { date: match[1], time: match[2] };
}

function getZonedParts(epochMs: number): WallClock {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TOURNAMENT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(epochMs));
  const map = new Map(parts.map((p) => [p.type, p.value]));
  return {
    year: Number(map.get('year')),
    month: Number(map.get('month')),
    day: Number(map.get('day')),
    hour: Number(map.get('hour')),
    minute: Number(map.get('minute')),
    second: Number(map.get('second')),
  };
}

function toUtcMs(parts: WallClock): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
}

function resolveEpochFromWallClock(wall: WallClock): number {
  let guess = toUtcMs(wall);
  for (let i = 0; i < 6; i += 1) {
    const current = getZonedParts(guess);
    const diffMs = toUtcMs(wall) - toUtcMs(current);
    if (diffMs === 0) return guess;
    guess += diffMs;
  }
  return guess;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function normalizeUtcIso(input: string): string {
  return new Date(input).toISOString();
}

export function parseSqlDateTimeToTournamentIso(sqlDateTime: string): string {
  const wall = parseParts(sqlDateTime);
  const epochMs = resolveEpochFromWallClock(wall);
  return new Date(epochMs).toISOString();
}

export function tournamentIsoFromDateAndTime(day: string, hhmm: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error(`Invalid day format: ${day}`);
  }
  if (!/^\d{2}:\d{2}$/.test(hhmm)) {
    throw new Error(`Invalid time format: ${hhmm}`);
  }
  return parseSqlDateTimeToTournamentIso(`${day} ${hhmm}:00`);
}

export function tournamentIsoToSqlDateTime(input: string): string {
  const epochMs = new Date(input).getTime();
  if (!Number.isFinite(epochMs)) {
    throw new Error(`Invalid tournament ISO datetime: ${input}`);
  }
  const parts = getZonedParts(epochMs);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)} ${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
}

export function sqlDatePart(sqlDateTime: string): string {
  return parseDateTimeParts(sqlDateTime).date;
}

export function sqlTimePart(sqlDateTime: string): string {
  return parseDateTimeParts(sqlDateTime).time;
}

export function withSqlDate(sqlDateTime: string, day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error(`Invalid day format: ${day}`);
  }
  const { time } = parseDateTimeParts(sqlDateTime);
  return `${day} ${time}`;
}
