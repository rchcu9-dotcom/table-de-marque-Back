import {
  Controller,
  Get,
  Header,
  INestApplication,
  Sse,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import passport from 'passport';
import { of, type Observable } from 'rxjs';
import { AuthGuard } from '@/auth/auth.guard';
import { Public } from '@/auth/decorators/public.decorator';
import { DriveImageProxyService } from '@/infrastructure/http/presentation/drive-image-proxy.service';
import { PresentationController } from '@/infrastructure/http/presentation/presentation.controller';
import { configureHttpSecurity } from '@/infrastructure/http/security/http-security';
import { PrismaService } from '@/infrastructure/persistence/mysql/prisma.service';

/** Routes hors /auth/* : mêmes en-têtes que le RIB et les flux SSE réels. */
@Controller('test-public')
@Public()
export class TestPublicController {
  @Get('ping')
  ping(): { ok: boolean } {
    return { ok: true };
  }

  @Get('rib')
  @Header('Cache-Control', 'private, no-store')
  rib(): string {
    return 'rib';
  }

  @Sse('flux')
  flux(): Observable<{ data: string }> {
    return of({ data: 'evenement' });
  }
}

export interface PrismaAuthMock {
  inscUtilisateur: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
  };
}

export interface HttpSecurityTestApp {
  app: INestApplication;
  prisma: PrismaAuthMock;
  driveImageProxy: { fetch: jest.Mock };
}

/**
 * Monte le vrai `AuthModule` (donc le vrai `ThrottlerModule.forRoot`), l'`AuthGuard` global
 * et `configureHttpSecurity`, comme `AppModule` et `main.ts`. Seul Prisma est remplacé.
 *
 * `buildInscriptionTestApp` ne convient pas : il appelle `init()` lui-même, alors que
 * `configureHttpSecurity` doit passer avant. `AuthModule` est chargé ici, et non importé en
 * tête de fichier, car il lit JWT_SECRET dès son chargement.
 *
 * Les variables d'environnement sont lues à la construction : les poser avant l'appel.
 */
export async function buildHttpSecurityTestApp(): Promise<HttpSecurityTestApp> {
  process.env.JWT_SECRET ??= 'secret-de-test';
  const { AuthModule } =
    jest.requireActual<typeof import('@/auth/auth.module')>(
      '@/auth/auth.module',
    );

  const utilisateur = {
    id: 1,
    providerUid: 'google-1',
    provider: 'google',
    email: 'coach@example.com',
    displayName: 'Coach',
    role: 'RESPONSABLE_EQUIPE',
  };
  const prisma: PrismaAuthMock = {
    inscUtilisateur: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(utilisateur),
      create: jest.fn().mockResolvedValue(utilisateur),
    },
  };
  const driveImageProxy = {
    fetch: jest.fn().mockResolvedValue({
      contentType: 'image/jpeg',
      buffer: Buffer.from('image'),
    }),
  };

  const moduleRef = await Test.createTestingModule({
    imports: [AuthModule],
    controllers: [TestPublicController, PresentationController],
    providers: [
      { provide: APP_GUARD, useExisting: AuthGuard },
      { provide: DriveImageProxyService, useValue: driveImageProxy },
    ],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    // Dépendances de PresentationController sans rapport avec la route d'image.
    .useMocker(() => ({}))
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  configureHttpSecurity(app);
  await app.init();

  return { app, prisma, driveImageProxy };
}

/**
 * Remplace la stratégie Google par une réponse immédiate : la vraie échangerait le `code`
 * auprès de Google. Sans `code`, la vraie stratégie ne fait qu'une redirection, sans réseau.
 */
export function givenGoogleAccepteLaConnexion(): void {
  passport.use('google', {
    name: 'google',
    authenticate(this: { success: (user: unknown) => void }) {
      this.success({
        providerId: 'google-1',
        email: 'coach@example.com',
        displayName: 'Coach',
      });
    },
  } as unknown as Parameters<typeof passport.use>[1]);
}
