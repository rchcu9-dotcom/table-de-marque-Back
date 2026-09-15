import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { REQUIRE_AUTH_KEY } from './decorators/require-auth.decorator';
import { ROLES_KEY } from './decorators/roles.decorator';
import { AuthPrismaService } from './auth-prisma.service';
import type { CurrentUserPayload } from './decorators/current-user.decorator';

interface LocalJwtPayload {
  sub: string; // providerUid
  email: string;
  displayName?: string;
}

interface RequestWithUser extends Request {
  user: CurrentUserPayload;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
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

    // Route publique : aucun décorateur d'auth posé
    if (!requireAuth && (!requiredRoles || requiredRoles.length === 0)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractBearer(request);
    if (!token) {
      throw new UnauthorizedException('Token manquant ou invalide');
    }

    let payload: LocalJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<LocalJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token invalide ou expiré');
    }

    // Relecture systématique en base (jamais confiance au claim du JWT pour le rôle)
    const utilisateur = await this.authPrisma.inscUtilisateur.findUnique({
      where: { providerUid: payload.sub },
    });
    if (!utilisateur) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }

    request.user = {
      id: utilisateur.id,
      providerUid: utilisateur.providerUid,
      email: utilisateur.email,
      displayName: utilisateur.displayName,
      pseudo: utilisateur.pseudo,
      role: utilisateur.role,
    };

    if (requiredRoles?.length && !requiredRoles.includes(utilisateur.role)) {
      throw new ForbiddenException(
        "Vous n'avez pas les droits nécessaires pour effectuer cette action",
      );
    }

    return true;
  }

  private extractBearer(request: Request): string | null {
    const authorization = request.headers['authorization'];
    if (!authorization || !authorization.startsWith('Bearer ')) return null;
    const token = authorization.slice(7).trim();
    return token || null;
  }
}
