import { Controller, Get, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthGuard } from './auth.guard';
import { AuthPrismaService } from './auth-prisma.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { RequireAuth } from './decorators/require-auth.decorator';
import { Roles } from './decorators/roles.decorator';

const SECRET = 'secret-de-test';

@Controller('routes')
class RoutesController {
  @Get('sans-decorateur')
  sansDecorateur(@CurrentUser() utilisateur: { role: string }) {
    return { role: utilisateur.role };
  }

  @Get('publique')
  @Public()
  publique(@CurrentUser() utilisateur: unknown) {
    return { utilisateur: utilisateur ?? null };
  }

  @Get('authentifiee')
  @RequireAuth()
  authentifiee() {
    return { ok: true };
  }

  @Get('organisateur')
  @Roles('ORGANISATEUR')
  organisateur() {
    return { ok: true };
  }

  @Get('plusieurs-roles')
  @Roles('TABLE_DE_MARQUE', 'ORGANISATEUR')
  plusieursRoles() {
    return { ok: true };
  }

  @Get('roles-vide')
  @Roles()
  rolesVide() {
    return { ok: true };
  }

  @Get('cumul')
  @Public()
  @Roles('ORGANISATEUR')
  cumul() {
    return { ok: true };
  }
}

@Controller('classe-publique')
@Public()
class ClassePubliqueController {
  @Get('libre')
  libre() {
    return { ok: true };
  }

  @Get('role')
  @Roles('ORGANISATEUR')
  role() {
    return { ok: true };
  }

  @Get('auth')
  @RequireAuth()
  auth() {
    return { ok: true };
  }
}

@Controller('classe-role')
@Roles('ORGANISATEUR')
class ClasseRoleController {
  @Get('herite')
  herite() {
    return { ok: true };
  }

  @Get('publique')
  @Public()
  publique() {
    return { ok: true };
  }
}

describe('AuthGuard', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const findUnique = jest.fn();

  const appeler = (route: string, token?: string) => {
    const appel = request(app.getHttpServer()).get(route);
    return token ? appel.set('Authorization', `Bearer ${token}`) : appel;
  };
  const jeton = () => jwt.signAsync({ sub: 'uid-1', email: 'a@b.fr' });

  function givenRole(role: string | null) {
    findUnique.mockResolvedValue(
      role && {
        id: 1,
        providerUid: 'uid-1',
        email: 'a@b.fr',
        displayName: null,
        pseudo: null,
        role,
      },
    );
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: SECRET })],
      controllers: [
        RoutesController,
        ClassePubliqueController,
        ClasseRoleController,
      ],
      providers: [
        AuthGuard,
        { provide: APP_GUARD, useExisting: AuthGuard },
        {
          provide: AuthPrismaService,
          useValue: { inscUtilisateur: { findUnique } },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    findUnique.mockReset();
    givenRole('RESPONSABLE_EQUIPE');
  });

  describe('route sans décorateur : privée par défaut (critère 1)', () => {
    it('401 sans token, sans lecture en base', async () => {
      const res = await appeler('/routes/sans-decorateur');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Token manquant ou invalide');
      expect(findUnique).not.toHaveBeenCalled();
    });

    it.each(['RESPONSABLE_EQUIPE', 'TABLE_DE_MARQUE', 'ORGANISATEUR'])(
      '200 avec un token valide, pour le rôle %s',
      async (role) => {
        givenRole(role);

        const res = await appeler('/routes/sans-decorateur', await jeton());

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ role });
      },
    );

    it('401 si l’en-tête n’est pas au format Bearer', async () => {
      const res = await request(app.getHttpServer())
        .get('/routes/sans-decorateur')
        .set('Authorization', 'Basic abc');

      expect(res.status).toBe(401);
    });

    it('401 sur un token invalide', async () => {
      const res = await appeler('/routes/sans-decorateur', 'pas-un-jwt');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Token invalide ou expiré');
    });

    it('401 si l’utilisateur n’existe plus', async () => {
      givenRole(null);

      const res = await appeler('/routes/sans-decorateur', await jeton());

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Utilisateur introuvable');
    });
  });

  describe('@Public() (critère 2)', () => {
    it('200 sans token', async () => {
      expect((await appeler('/routes/publique')).status).toBe(200);
    });

    it('200 avec un token invalide : aucune vérification', async () => {
      expect((await appeler('/routes/publique', 'pas-un-jwt')).status).toBe(
        200,
      );
    });

    it('200 avec un token expiré', async () => {
      const expire = await jwt.signAsync(
        { sub: 'uid-1', email: 'a@b.fr' },
        { expiresIn: -10 },
      );

      expect((await appeler('/routes/publique', expire)).status).toBe(200);
    });

    it('ne lit pas la base et ne renseigne pas request.user', async () => {
      const res = await appeler('/routes/publique', await jeton());

      expect(res.body).toEqual({ utilisateur: null });
      expect(findUnique).not.toHaveBeenCalled();
    });

    it('s’applique à toute la classe', async () => {
      expect((await appeler('/classe-publique/libre')).status).toBe(200);
    });
  });

  describe('@Roles et @RequireAuth inchangés (critère 3)', () => {
    it.each(['/routes/authentifiee', '/routes/organisateur'])(
      '%s : 401 sans token',
      async (route) => {
        expect((await appeler(route)).status).toBe(401);
      },
    );

    it.each(['/routes/authentifiee', '/routes/organisateur'])(
      '%s : 401 sur un token expiré',
      async (route) => {
        const expire = await jwt.signAsync(
          { sub: 'uid-1', email: 'a@b.fr' },
          { expiresIn: -10 },
        );

        expect((await appeler(route, expire)).status).toBe(401);
      },
    );

    it('@RequireAuth : 200 pour tout rôle', async () => {
      expect(
        (await appeler('/routes/authentifiee', await jeton())).status,
      ).toBe(200);
    });

    it('@Roles : 403 sur un rôle insuffisant, avec le message habituel', async () => {
      const res = await appeler('/routes/organisateur', await jeton());

      expect(res.status).toBe(403);
      expect(res.body.message).toBe(
        "Vous n'avez pas les droits nécessaires pour effectuer cette action",
      );
    });

    it('@Roles : 200 avec le bon rôle', async () => {
      givenRole('ORGANISATEUR');

      expect(
        (await appeler('/routes/organisateur', await jeton())).status,
      ).toBe(200);
    });

    it('@Roles à plusieurs rôles : chacun passe', async () => {
      givenRole('TABLE_DE_MARQUE');

      expect(
        (await appeler('/routes/plusieurs-roles', await jeton())).status,
      ).toBe(200);
    });

    it('le rôle vient de la base, jamais du JWT', async () => {
      givenRole('RESPONSABLE_EQUIPE');
      const token = await jwt.signAsync({
        sub: 'uid-1',
        email: 'a@b.fr',
        role: 'ORGANISATEUR',
      });

      expect((await appeler('/routes/organisateur', token)).status).toBe(403);
    });

    it('@Roles de classe s’applique aux méthodes', async () => {
      expect((await appeler('/classe-role/herite', await jeton())).status).toBe(
        403,
      );
    });

    it('@Roles() sans rôle : token exigé, plus jamais public', async () => {
      expect((await appeler('/routes/roles-vide')).status).toBe(401);
      expect((await appeler('/routes/roles-vide', await jeton())).status).toBe(
        200,
      );
    });
  });

  describe('combinaisons incohérentes : la protection l’emporte (critère 4)', () => {
    it.each([
      '/classe-publique/role',
      '/classe-role/publique',
      '/routes/cumul',
    ])('%s : 401 sans token, 403 sans le rôle, 200 avec', async (route) => {
      expect((await appeler(route)).status).toBe(401);
      expect((await appeler(route, await jeton())).status).toBe(403);

      givenRole('ORGANISATEUR');

      expect((await appeler(route, await jeton())).status).toBe(200);
    });

    it('classe @Public + méthode @RequireAuth : token exigé', async () => {
      expect((await appeler('/classe-publique/auth')).status).toBe(401);
    });
  });
});
