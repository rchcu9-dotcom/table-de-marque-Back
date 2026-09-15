export type CacheKey =
  | 'equipes'
  | 'classement'
  | 'matches'
  | 'j3carres'
  | 'meals'
  | 'planning'
  | 'presentation'
  | 'bootstrap';

export type CacheEntry<T> = { data: T; updatedAt: number };
