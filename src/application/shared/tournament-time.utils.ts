import type { Match } from '@/domain/match/entities/match.entity';
import {
  buildParisInstantFromLocalParts,
  formatParisIso,
  parisDateKey,
} from '@/infrastructure/persistence/mysql/date-paris.utils';

export type TournamentDayKey = 'J1' | 'J2' | 'J3';

const TOURNAMENT_DAYS: TournamentDayKey[] = ['J1', 'J2', 'J3'];

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

function uniqueSortedDateKeys(matches: Match[]) {
  return Array.from(
    new Set(
      matches
        .filter((match) => match.status !== 'deleted')
        .map((match) => parisDateKey(new Date(match.date))),
    ),
  ).sort();
}

export function getTournamentDateKeys(matches: Match[]) {
  return uniqueSortedDateKeys(matches).slice(0, 3);
}

export function getCurrentTournamentDay(
  matches: Match[],
  now: Date,
): TournamentDayKey {
  const dateKeys = getTournamentDateKeys(matches);
  if (dateKeys.length === 0) return 'J1';

  const todayKey = parisDateKey(now);
  const [, j2, j3] = dateKeys;

  if (!j2 || todayKey < j2) return 'J1';
  if (!j3 || todayKey < j3) return 'J2';
  return 'J3';
}

export function getTournamentDayDateKey(
  matches: Match[],
  day: TournamentDayKey,
): string | null {
  const taggedMatches = matches
    .filter((match) => match.status !== 'deleted' && match.jour === day)
    .sort((left, right) => left.date.getTime() - right.date.getTime());
  if (taggedMatches.length > 0) {
    return parisDateKey(new Date(taggedMatches[0].date));
  }

  const fallbackDateKey =
    getTournamentDateKeys(matches)[TOURNAMENT_DAYS.indexOf(day)];
  return fallbackDateKey ?? null;
}

export function buildTournamentDateTimeIso(
  dateKey: string | null,
  time: string,
) {
  if (!dateKey) return null;

  const [year, month, day] = dateKey.split('-').map((value) => Number(value));
  const [hours, minutes] = time.split(':').map((value) => Number(value));
  const instant = buildParisInstantFromLocalParts(
    Number.isFinite(year) ? year : 1970,
    Number.isFinite(month) ? month : 1,
    Number.isFinite(day) ? day : 1,
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
  );
  return formatParisIso(instant);
}

export function normalizeTournamentDateTimeIso(value: Date | null) {
  return value ? formatParisIso(value) : null;
}

export function buildTournamentDateTimeMs(
  dateKey: string | null,
  time: string,
) {
  const iso = buildTournamentDateTimeIso(dateKey, time);
  if (!iso) return Number.POSITIVE_INFINITY;
  return new Date(iso).getTime();
}

export function buildTournamentDayLabel(dateKey: string | null) {
  if (!dateKey) return null;
  const [year, month, day] = dateKey.split('-').map((value) => Number(value));
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}
