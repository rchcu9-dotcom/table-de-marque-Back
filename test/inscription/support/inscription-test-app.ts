import { INestApplication, Provider, Type } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AuthPrismaService } from '@/auth/auth-prisma.service';
import { TestAuthGuard } from './test-auth.guard';

export interface PrismaUtilisateurMock {
  inscUtilisateur: { findUnique: jest.Mock };
}

export interface InscriptionTestApp {
  app: INestApplication;
  prisma: PrismaUtilisateurMock;
}

/**
 * Monte un `INestApplication` minimal pour un (ou plusieurs) contrôleur(s) du
 * module inscription, avec `TestAuthGuard` posé en `APP_GUARD` à la place du
 * vrai `AuthGuard` (seule la vérification JWT est court-circuitée ; la
 * résolution du rôle via `AuthPrismaService` reste identique à la prod).
 *
 * Par défaut, `inscUtilisateur.findUnique` résout un utilisateur
 * `RESPONSABLE_EQUIPE` : suffisant pour les routes `@RequireAuth()` sans
 * contrainte de rôle. Utiliser `givenRole` pour les routes `@Roles(...)`.
 */
export async function buildInscriptionTestApp(
  controllers: Type<any>[],
  useCaseProviders: Provider[],
): Promise<InscriptionTestApp> {
  const prisma: PrismaUtilisateurMock = {
    inscUtilisateur: {
      findUnique: jest.fn().mockResolvedValue({ role: 'RESPONSABLE_EQUIPE' }),
    },
  };

  const moduleRef = await Test.createTestingModule({
    controllers,
    providers: [
      ...useCaseProviders,
      { provide: AuthPrismaService, useValue: prisma },
      { provide: APP_GUARD, useClass: TestAuthGuard },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  return { app, prisma };
}

/**
 * Configure la résolution de rôle de `TestAuthGuard` (relecture DB, via
 * `AuthPrismaService` mocké) pour le prochain appel à
 * `inscUtilisateur.findUnique`.
 * `role === null` simule un `InscUtilisateur` introuvable (-> 401, comme en
 * prod : cf. `AuthGuard`).
 */
export function givenRole(
  prisma: PrismaUtilisateurMock,
  role: 'ORGANISATEUR' | 'RESPONSABLE_EQUIPE' | null,
): void {
  prisma.inscUtilisateur.findUnique.mockResolvedValue(
    role === null ? null : { role },
  );
}
