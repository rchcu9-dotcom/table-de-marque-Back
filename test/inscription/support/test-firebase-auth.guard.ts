import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CurrentUserPayload } from '@/auth/decorators/current-user.decorator';

interface RequestWithUser {
  headers: { authorization?: string };
  user: CurrentUserPayload;
}

/**
 * Remplace `FirebaseAuthGuard` dans les tests d'intégration : pas d'appel à
 * `firebase-admin`, l'uid est extrait directement du header `Authorization: Bearer <uid>`.
 */
@Injectable()
export class TestFirebaseAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const uid = authHeader.slice(7);
    request.user = {
      uid,
      email: `${uid}@test.local`,
      name: uid,
    };
    return true;
  }
}
