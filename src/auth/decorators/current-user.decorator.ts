import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UtilisateurRole } from '@prisma/client';

export interface CurrentUserPayload {
  id: number;
  providerUid: string;
  email: string;
  displayName: string | null;
  pseudo: string | null;
  role: UtilisateurRole;
}

interface RequestWithUser {
  user: CurrentUserPayload;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
