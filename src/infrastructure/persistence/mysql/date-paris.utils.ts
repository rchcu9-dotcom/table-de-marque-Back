const PARIS_TIME_ZONE = 'Europe/Paris';

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const parisOffsetFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: PARIS_TIME_ZONE,
  timeZoneName: 'shortOffset',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function getWallParts(date: Date): DateParts {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
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
