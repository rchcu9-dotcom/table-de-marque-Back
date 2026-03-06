import type { Match } from '@/domain/match/entities/match.entity';
import type { MealSource } from '@/domain/meal/repositories/meal.repository';
import {
  getCurrentTournamentDay,
  normalizeTournamentDateTimeIso,
} from '@/application/shared/tournament-time.utils';

export type MealDayKey = 'J1' | 'J2' | 'J3';

export type MealDay = {
  key: MealDayKey;
  label: string;
  dateTime: string | null;
  message?: string | null;
};

export type MealsPayload = {
  days: MealDay[];
  mealOfDay: MealDay | null;
};

export function computeMealDayKey(matches: Match[], now: Date): MealDayKey {
  return getCurrentTournamentDay(matches, now);
}

export function buildMealsPayload(
  source: MealSource,
  matches: Match[],
  now: Date,
): MealsPayload {
  const toIso = (value: Date | null) => normalizeTournamentDateTimeIso(value);
  const days: MealDay[] = [
    {
      key: 'J1',
      label: 'J1',
      dateTime: toIso(source.repasSamedi),
      message: source.repasSamedi ? null : 'Repas indisponible',
    },
    {
      key: 'J2',
      label: 'J2',
      dateTime: toIso(source.repasDimanche),
      message: source.repasDimanche ? null : 'Repas indisponible',
    },
    {
      key: 'J3',
      label: 'J3',
      dateTime: null,
      message: 'Repas indisponible',
    },
  ];

  const key = computeMealDayKey(matches, now);
  const mealOfDay = days.find((day) => day.key === key) ?? null;
  return { days, mealOfDay };
}
