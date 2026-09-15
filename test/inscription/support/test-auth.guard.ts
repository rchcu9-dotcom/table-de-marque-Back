import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { REQUIRE_AUTH_KEY } from '@/auth/decorators/require-auth.decorator';
import { ROLES_KEY } from '@/auth/decorators/roles.decorator';
import { AuthPrismaService } from '@/auth/auth-prisma.service';
import type { CurrentUserPayload } from '@/auth/decorators/current-user.decorator';

interface RequestWithUser extends Request {
  user: CurrentUserPayload;
}

/**
 * Remplace `AuthGuard` dans les tests d'intégration : pas de vérification
 * JWT, le token Bearer est utilisé tel quel comme `providerUid`. Le rôle est
 * résolu via `AuthPrismaService.inscUtilisateur.findUnique` (mocké par
 * `buildInscriptionTestApp`/`givenRole`), pour reproduire fidèlement la
 * logique de `src/auth/auth.guard.ts`.
 */
@Injectable()
export class TestAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authPrisma: AuthPrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requireAuth = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requireAuth && (!requiredRoles || requiredRoles.length === 0)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authorization = request.headers['authorization'];
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token manquant ou invalide');
    }
    const providerUid = authorization.slice(7).trim();
    if (!providerUid) {
      throw new UnauthorizedException('Token manquant ou invalide');
    }

    const utilisateur = await this.authPrisma.inscUtilisateur.findUnique({
      where: { providerUid },
    });
    if (!utilisateur) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }

    request.user = {
      id: utilisateur.id ?? 1,
      providerUid,
      email: utilisateur.email ?? `${providerUid}@test.local`,
      displayName: utilisateur.displayName ?? null,
      pseudo: utilisateur.pseudo ?? null,
      role: utilisateur.role,
    };

    if (requiredRoles?.length && !requiredRoles.includes(utilisateur.role)) {
      throw new ForbiddenException(
        "Vous n'avez pas les droits nécessaires pour effectuer cette action",
      );
    }

    return true;
  }
}
