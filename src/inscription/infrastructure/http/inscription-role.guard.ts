import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../auth/decorators/roles.decorator';
import type { CurrentUserPayload } from '../../../auth/decorators/current-user.decorator';
import { InscriptionPrismaService } from '../persistence/inscription-prisma.service';

interface RequestWithUser {
  user: CurrentUserPayload;
}

@Injectable()
export class InscriptionRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: InscriptionPrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const uid = request.user?.uid;

    if (!uid) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    const utilisateur = await this.prisma.inscUtilisateur.findUnique({
      where: { firebaseUid: uid },
      select: { role: true },
    });

    if (!utilisateur || !requiredRoles.includes(utilisateur.role)) {
      throw new ForbiddenException(
        "Vous n'avez pas les droits nécessaires pour effectuer cette action",
      );
    }

    return true;
  }
}
