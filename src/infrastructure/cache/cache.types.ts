export type CacheKey =
  | 'equipes'
  | 'classement'
  | 'matches'
  | 'meals'
  | 'planning'
  | 'bootstrap';

export type CacheEntry<T> = { data: T; updatedAt: number };
