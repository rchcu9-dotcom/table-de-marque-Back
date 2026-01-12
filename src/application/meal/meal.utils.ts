import type { Match } from '@/domain/match/entities/match.entity';
import type { MealSource } from '@/domain/meal/repositories/meal.repository';

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

function normalizeDay(date: Date): string {
  return date.toISOString().split('T')[0];
}

function sortedDayKeys(matches: Match[]): string[] {
  const unique = new Set<string>();
  matches.forEach((m) => {
    unique.add(normalizeDay(new Date(m.date)));
  });
  return Array.from(unique).sort();
}

export function computeMealDayKey(
  matches: Match[],
  now: Date,
): MealDayKey {
  const days = sortedDayKeys(matches);
  if (!days.length) return 'J1';

  const today = normalizeDay(now);
  const day1 = days[0];
  const day2 = days[1];
  const day3 = days[2];

  if (today < day1) return 'J1';
  if (!day2) return 'J1';
  if (today < day2) return 'J1';
  if (!day3) return 'J2';
  if (today < day3) return 'J2';
  return 'J3';
}

export function buildMealsPayload(
  source: MealSource,
  matches: Match[],
  now: Date,
): MealsPayload {
  const toIso = (value: Date | null) => (value ? value.toISOString() : null);
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
