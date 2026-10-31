import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@/auth/auth.guard';
import type { AuthPrismaService } from '@/auth/auth-prisma.service';
import { Public } from '@/auth/decorators/public.decorator';
import { RequireAuth } from '@/auth/decorators/require-auth.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { TestAuthGuard } from '../inscription/support/test-auth.guard';

// docs/specs/rendre-le-guard-global-priv-par-dfaut-avec-un-dcorateur-publ.md — critère 5
// Les tests d'intégration valident TestAuthGuard : s'il dérivait, ils ne prouveraient plus rien.

class Routes {
  sansDecorateur(): void {}

  @Public()
  publique(): void {}

  @RequireAuth()
  authentifiee(): void {}

  @Roles('ORGANISATEUR')
  organisateur(): void {}

  @Roles()
  rolesVide(): void {}

  @Public()
  @Roles('ORGANISATEUR')
  cumul(): void {}
}

@Public()
class ClassePublique {
  libre(): void {}

  @Roles('ORGANISATEUR')
  protegee(): void {}
}

const CAS: [string, () => void, object][] = [
  ['sans décorateur', Routes.prototype.sansDecorateur, Routes],
  ['@Public', Routes.prototype.publique, Routes],
  ['@RequireAuth', Routes.prototype.authentifiee, Routes],
  ['@Roles', Routes.prototype.organisateur, Routes],
  ['@Roles() vide', Routes.prototype.rolesVide, Routes],
  ['@Public + @Roles', Routes.prototype.cumul, Routes],
  ['classe @Public', ClassePublique.prototype.libre, ClassePublique],
  [
    'classe @Public + méthode @Roles',
    ClassePublique.prototype.protegee,
    ClassePublique,
  ],
];

const APPELS: [string, string | undefined, string | null][] = [
  ['sans token', undefined, null],
  ['utilisateur inconnu', 'Bearer uid-1', null],
  ['rôle insuffisant', 'Bearer uid-1', 'RESPONSABLE_EQUIPE'],
  ['rôle suffisant', 'Bearer uid-1', 'ORGANISATEUR'],
];

function contexte(
  handler: () => void,
  classe: object,
  authorization: string | undefined,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => classe,
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  } as unknown as ExecutionContext;
}

async function issue(appel: Promise<boolean>): Promise<string | boolean> {
  return appel.catch((e: Error) => e.message);
}

describe('TestAuthGuard reproduit AuthGuard', () => {
  describe.each(CAS)('%s', (_nom, handler, classe) => {
    it.each(APPELS)('%s', async (_cas, authorization, role) => {
      const authPrisma = {
        inscUtilisateur: {
          findUnique: jest.fn().mockResolvedValue(role && { role }),
        },
      } as unknown as AuthPrismaService;
      const jwt = {
        verifyAsync: jest.fn().mockResolvedValue({ sub: 'uid-1' }),
      } as unknown as JwtService;
      const reflector = new Reflector();
      const contexteReel = contexte(handler, classe, authorization);
      const contexteTest = contexte(handler, classe, authorization);

      const reel = await issue(
        new AuthGuard(reflector, jwt, authPrisma).canActivate(contexteReel),
      );
      const test = await issue(
        new TestAuthGuard(reflector, authPrisma).canActivate(contexteTest),
      );

      expect(test).toBe(reel);
    });
  });

  it('TestAuthGuard refuse une route sans décorateur et sans token', async () => {
    const authPrisma = {
      inscUtilisateur: { findUnique: jest.fn() },
    } as unknown as AuthPrismaService;

    await expect(
      new TestAuthGuard(new Reflector(), authPrisma).canActivate(
        contexte(Routes.prototype.sansDecorateur, Routes, undefined),
      ),
    ).rejects.toThrow('Token manquant ou invalide');
  });
});
