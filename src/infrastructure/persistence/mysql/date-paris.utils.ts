const PARIS_TIME_ZONE = 'Europe/Paris';

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const parisDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: PARIS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const parisOffsetFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: PARIS_TIME_ZONE,
  timeZoneName: 'shortOffset',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function getWallParts(date: Date): DateParts {
  const parts = parisDateTimeFormatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

function getParisOffsetMinutes(instant: Date): number {
  const parts = parisOffsetFormatter.formatToParts(instant);
  const tz = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+-]\d{1,2})(?::(\d{2}))?/.exec(tz);
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  return hours * 60 + Math.sign(hours) * minutes;
}

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

function padOffset(value: number) {
  return value.toString().padStart(2, '0');
}

function formatOffsetMinutes(offsetMinutes: number) {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `${sign}${padOffset(hours)}:${padOffset(minutes)}`;
}

export function buildParisInstantFromLocalParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  let offsetMinutes = getParisOffsetMinutes(new Date(utcGuess));
  let instantMs = utcGuess - offsetMinutes * 60_000;

  const correctedOffsetMinutes = getParisOffsetMinutes(new Date(instantMs));
  if (correctedOffsetMinutes !== offsetMinutes) {
    offsetMinutes = correctedOffsetMinutes;
    instantMs = utcGuess - offsetMinutes * 60_000;
  }

  return new Date(instantMs);
}

export function parseParisSqlDateTime(value: string | null): Date | null {
  if (!value) return null;

  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(
    trimmed,
  );
  if (!match) {
    throw new Error(`Invalid MySQL DATETIME value: ${value}`);
  }

  return buildParisInstantFromLocalParts(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  );
}

export function parseRequiredParisSqlDateTime(
  value: string | null,
  label: string,
): Date {
  const parsed = parseParisSqlDateTime(value);
  if (!parsed) {
    throw new Error(`Missing required MySQL DATETIME value for ${label}`);
  }
  return parsed;
}

export function parisDateKey(date: Date): string {
  const parts = getWallParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function formatParisIso(date: Date): string {
  const parts = getWallParts(date);
  const instant = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ),
  );
  const offset = formatOffsetMinutes(getParisOffsetMinutes(instant));
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}${offset}`;
}
