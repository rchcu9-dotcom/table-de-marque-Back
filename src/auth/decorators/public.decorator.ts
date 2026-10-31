import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Déclare une route accessible sans token : toute autre route est privée par défaut.
 * À inscrire aussi dans PUBLIC_ROUTES (test/auth/route-access-inventory.spec.ts).
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
