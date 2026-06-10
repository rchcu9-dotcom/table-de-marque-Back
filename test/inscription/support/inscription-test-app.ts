import { INestApplication, Provider, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FirebaseAuthGuard } from '@/auth/firebase-auth.guard';
import { InscriptionRoleGuard } from '@/inscription/infrastructure/http/inscription-role.guard';
import { InscriptionPrismaService } from '@/inscription/infrastructure/persistence/inscription-prisma.service';
import { TestFirebaseAuthGuard } from './test-firebase-auth.guard';

export interface PrismaUtilisateurMock {
  inscUtilisateur: { findUnique: jest.Mock };
}

export interface InscriptionTestApp {
  app: INestApplication;
  prisma: PrismaUtilisateurMock;
}

/**
 * Monte un `INestApplication` minimal pour un (ou plusieurs) contrôleur(s) du
 * module inscription, avec la chaîne `FirebaseAuthGuard -> InscriptionRoleGuard
 * -> @Roles` réelle (seul `FirebaseAuthGuard` est remplacé par
 * `TestFirebaseAuthGuard` et `InscriptionPrismaService` est mocké).
 */
export async function buildInscriptionTestApp(
  controllers: Type<any>[],
  useCaseProviders: Provider[],
): Promise<InscriptionTestApp> {
  const prisma: PrismaUtilisateurMock = {
    inscUtilisateur: { findUnique: jest.fn() },
  };

  const moduleRef = await Test.createTestingModule({
    controllers,
    providers: [
      ...useCaseProviders,
      InscriptionRoleGuard,
      { provide: InscriptionPrismaService, useValue: prisma },
    ],
  })
    .overrideGuard(FirebaseAuthGuard)
    .useClass(TestFirebaseAuthGuard)
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  return { app, prisma };
}

/**
 * Configure la résolution de rôle de `InscriptionRoleGuard` pour le prochain
 * appel à `inscUtilisateur.findUnique`.
 * `role === null` simule un `InscUtilisateur` introuvable (-> 403).
 */
export function givenRole(
  prisma: PrismaUtilisateurMock,
  role: 'ORGANISATEUR' | 'RESPONSABLE_EQUIPE' | null,
): void {
  prisma.inscUtilisateur.findUnique.mockResolvedValue(
    role === null ? null : { role },
  );
}
