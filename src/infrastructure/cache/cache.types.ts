export type CacheKey =
  | 'equipes'
  | 'classement'
  | 'matches'
  | 'planning'
  | 'bootstrap';

export type CacheEntry<T> = { data: T; updatedAt: number };
