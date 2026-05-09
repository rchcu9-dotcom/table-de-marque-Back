import { ForbiddenException } from '@nestjs/common';

export const API_READ_ONLY_MESSAGE =
  'API en mode lecture seule sur cet environnement';

export function assertApiWritable() {
  const isReadOnly = (process.env.API_READ_ONLY ?? '').trim().toLowerCase() === 'true';
  if (isReadOnly) {
    throw new ForbiddenException(API_READ_ONLY_MESSAGE);
  }
}
