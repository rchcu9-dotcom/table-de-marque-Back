import type { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { REQUIRE_AUTH_KEY } from './decorators/require-auth.decorator';
import { ROLES_KEY } from './decorators/roles.decorator';

export interface AccessMetadata {
  isPublic?: boolean;
  requireAuth?: boolean;
  roles?: string[];
}

export type AccessPolicy = 'public' | 'authenticated' | { roles: string[] };

type AccessMetadataTargets = Parameters<Reflector['getAllAndOverride']>[1];

/** Métadonnées de la route ; `targets` : handler puis classe. */
export function readAccessMetadata(
  reflector: Reflector,
  targets: AccessMetadataTargets,
): AccessMetadata {
  return {
    isPublic: reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets),
    requireAuth: reflector.getAllAndOverride<boolean>(
      REQUIRE_AUTH_KEY,
      targets,
    ),
    roles: reflector.getAllAndOverride<string[]>(ROLES_KEY, targets),
  };
}

/**
 * Règle d'accès unique, privée par défaut : seule une route `@Public()` sans autre décorateur
 * échappe au token. En cas de contradiction, la protection l'emporte.
 */
export function resolveAccess({
  isPublic,
  requireAuth,
  roles,
}: AccessMetadata): AccessPolicy {
  if (roles?.length) return { roles };
  if (requireAuth) return 'authenticated';
  return isPublic ? 'public' : 'authenticated';
}

/** `@Public()` combiné à `@Roles` ou `@RequireAuth` : erreur du test d'inventaire. */
export function hasConflictingAccess({
  isPublic,
  requireAuth,
  roles,
}: AccessMetadata): boolean {
  return Boolean(isPublic) && (Boolean(requireAuth) || Boolean(roles?.length));
}
