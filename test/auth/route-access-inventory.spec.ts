import * as fs from 'fs';
import * as path from 'path';
import {
  Controller,
  Delete,
  forwardRef,
  Get,
  Module,
  Post,
  Sse,
  type DynamicModule,
} from '@nestjs/common';
import { resolveAccess } from '@/auth/access-policy';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { RequireAuth } from '@/auth/decorators/require-auth.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import {
  controlerInventaire,
  discoverControllers,
  listRoutes,
  type RouteInventoryEntry,
} from './support/route-inventory';

// docs/specs/rendre-le-guard-global-priv-par-dfaut-avec-un-dcorateur-publ.md — § 2.5
// Rendre une route publique est une décision visible : `@Public()` ET une ligne ici.

const PUBLIC_ROUTES = [
  'GET /auth/google',
  'GET /auth/google/callback',
  'POST /auth/dev-login',
  'GET /challenge/all',
  'GET /challenge/ateliers',
  'GET /challenge/ateliers/:id/classement',
  'GET /challenge/classement-global',
  'GET /challenge/equipes/:id',
  'GET /challenge/gardien/j3',
  'GET /challenge/j1/momentum',
  'GET /challenge/stream',
  'GET /challenge/vitesse/j3',
  'GET /equipes',
  'GET /equipes/:id',
  'GET /health',
  'GET /inscription/edition/courante',
  'GET /inscription/equipes',
  'GET /joueurs',
  'GET /joueurs/:id',
  'GET /live/status',
  'GET /live/stream',
  'GET /matches',
  'GET /matches/:id',
  'GET /matches/:id/classement',
  'GET /matches/momentum',
  'GET /matches/stream',
  'GET /meals',
  'GET /partenaires',
  'GET /poules/:code/classement',
  'GET /presentation',
  'GET /presentation/image/:fileId',
  'GET /table-de-marque/matches/:numMatch/effectifs',
  'GET /table-de-marque/matches/:numMatch/live',
  'GET /tournoi/5v5/j3/carres',
];

const PUBLIC_WRITES = ['POST /auth/dev-login'];

/** Fichiers présents dans src/ mais déclarés dans aucun module : leurs routes n'existent pas. */
const CONTROLEURS_NON_MONTES = ['app.controller.ts'];

const ECRITURES_LEGACY = [
  'POST /matches',
  'PUT /matches/:id',
  'DELETE /matches/:id',
  'POST /challenge/ateliers/:id/tentatives',
];

const SRC = path.resolve(__dirname, '../../src');

function fichiersControleurs(dossier: string): string[] {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = path.join(dossier, entree.name);
    if (entree.isDirectory()) return fichiersControleurs(chemin);
    return entree.name.endsWith('.controller.ts') ? [entree.name] : [];
  });
}

describe('Inventaire des routes du vrai AppModule', () => {
  let routes: RouteInventoryEntry[];
  let nbControleurs: number;

  beforeAll(() => {
    // AuthModule lit ce secret dès son chargement. Aucun provider n'est instancié.
    process.env.JWT_SECRET ??= 'secret-de-test';
    const { AppModule } =
      jest.requireActual<typeof import('@/app.module')>('@/app.module');
    const controleurs = discoverControllers(AppModule);
    nbControleurs = controleurs.length;
    routes = listRoutes(controleurs);
  });

  it('ne présente aucune anomalie (critère 10)', () => {
    expect(
      controlerInventaire(routes, {
        publicRoutes: PUBLIC_ROUTES,
        publicWrites: PUBLIC_WRITES,
      }),
    ).toEqual([]);
  });

  it('PUBLIC_ROUTES ne contient aucun doublon', () => {
    expect(new Set(PUBLIC_ROUTES).size).toBe(PUBLIC_ROUTES.length);
  });

  it('expose exactement 34 routes publiques', () => {
    const publiques = routes.filter(
      (r) => resolveAccess(r.metadata) === 'public',
    );

    expect(publiques.map((r) => r.route).sort()).toEqual(
      [...PUBLIC_ROUTES].sort(),
    );
  });

  it('ne laisse aucune route sans décorateur d’auth', () => {
    const nues = routes.filter(
      ({ metadata: { isPublic, requireAuth, roles } }) =>
        !isPublic && !requireAuth && !roles?.length,
    );

    expect(nues.map((r) => r.route)).toEqual([]);
  });

  it('la seule écriture publique est POST /auth/dev-login', () => {
    const ecritures = routes
      .filter((r) => resolveAccess(r.metadata) === 'public')
      .filter((r) => !r.route.startsWith('GET '));

    expect(ecritures.map((r) => r.route)).toEqual(PUBLIC_WRITES);
  });

  it.each(ECRITURES_LEGACY)('%s est réservée à ORGANISATEUR', (route) => {
    const entree = routes.find((r) => r.route === route);

    expect(entree && resolveAccess(entree.metadata)).toEqual({
      roles: ['ORGANISATEUR'],
    });
  });

  it.each(['GET /matches/stream', 'GET /challenge/stream', 'GET /live/stream'])(
    '%s reste public : EventSource n’envoie pas de token',
    (route) => {
      const entree = routes.find((r) => r.route === route);

      expect(entree && resolveAccess(entree.metadata)).toBe('public');
    },
  );

  it('GET / n’existe pas : AppController n’est monté dans aucun module', () => {
    expect(routes.map((r) => r.route)).not.toContain('GET /');
  });

  it('découvre tous les contrôleurs de src/, hors exceptions nommées', () => {
    const fichiers = fichiersControleurs(SRC);

    expect(fichiers).toEqual(expect.arrayContaining(CONTROLEURS_NON_MONTES));
    expect(nbControleurs).toBe(fichiers.length - CONTROLEURS_NON_MONTES.length);
  });

  it('la sonde HEALTHCHECK du Dockerfile vise une route publique (critère 9)', () => {
    const dockerfile = fs.readFileSync(
      path.resolve(SRC, '../Dockerfile'),
      'utf8',
    );
    const [, chemin] = /HEALTHCHECK[\s\S]*?localhost:[^/]*(\/\w*)/.exec(
      dockerfile,
    ) ?? [undefined, undefined];
    const entree = routes.find((r) => r.route === `GET ${chemin}`);

    expect(chemin).toBe('/health');
    expect(entree && resolveAccess(entree.metadata)).toBe('public');
  });

  it('aucun préfixe global : le test devrait sinon en tenir compte', () => {
    const main = fs.readFileSync(path.join(SRC, 'main.ts'), 'utf8');

    expect(main).not.toContain('setGlobalPrefix');
    expect(main).not.toContain('enableVersioning');
  });
});

describe('listRoutes', () => {
  @Controller('faux')
  class FauxController {
    @Get()
    racine(): void {}

    @Get(':id/detail')
    @Public()
    detail(): void {}

    @Get(['a', 'b'])
    double(): void {}

    @Sse('flux')
    flux(): void {}

    @Post('moi')
    moi(@CurrentUser() _utilisateur: unknown): void {}

    outil(): void {}
  }

  @Controller()
  class SansPrefixeController {
    @Get('poules')
    poules(): void {}

    @Get()
    accueil(): void {}
  }

  const routes = listRoutes([FauxController, SansPrefixeController]);

  it('calcule les routes, sans les méthodes qui n’en sont pas', () => {
    expect(routes.map((r) => r.route)).toEqual([
      'GET /faux',
      'GET /faux/:id/detail',
      'GET /faux/a',
      'GET /faux/b',
      'GET /faux/flux',
      'POST /faux/moi',
      'GET /poules',
      'GET /',
    ]);
  });

  it('nomme le contrôleur et la méthode', () => {
    expect(routes[1]).toMatchObject({
      controller: 'FauxController',
      handler: 'detail',
    });
  });

  it('repère @CurrentUser() (règle 5)', () => {
    expect(
      routes.filter((r) => r.usesCurrentUser).map((r) => r.handler),
    ).toEqual(['moi']);
  });

  it('lit @Public() de méthode comme de classe', () => {
    @Controller('publique')
    @Public()
    class PubliqueController {
      @Get()
      liste(): void {}
    }

    const [route] = listRoutes([PubliqueController]);

    expect(resolveAccess(route.metadata)).toBe('public');
  });
});

describe('discoverControllers', () => {
  @Controller('a')
  class AController {}
  @Controller('b')
  class BController {}
  @Controller('c')
  class CController {}
  @Controller('d')
  class DController {}

  @Module({ controllers: [BController] })
  class BModule {}

  class DynamiqueModule {
    static forRoot(): DynamicModule {
      return { module: DynamiqueModule, controllers: [CController] };
    }
  }

  @Module({ controllers: [DController] })
  class DiffereModule {}

  it('suit les imports, les modules dynamiques et les forwardRef', () => {
    @Module({
      imports: [
        BModule,
        DynamiqueModule.forRoot(),
        forwardRef(() => DiffereModule),
      ],
      controllers: [AController],
    })
    class RacineModule {}

    expect(discoverControllers(RacineModule)).toEqual(
      expect.arrayContaining([
        AController,
        BController,
        CController,
        DController,
      ]),
    );
  });

  it('ne compte un contrôleur qu’une fois', () => {
    @Module({ imports: [BModule, BModule], controllers: [BController] })
    class RacineModule {}

    expect(discoverControllers(RacineModule)).toEqual([BController]);
  });

  it('s’arrête sur un cycle d’imports', () => {
    @Module({
      imports: [forwardRef(() => SecondModule)],
      controllers: [AController],
    })
    class PremierModule {}

    @Module({
      imports: [forwardRef(() => PremierModule)],
      controllers: [BController],
    })
    class SecondModule {}

    expect(discoverControllers(PremierModule)).toEqual([
      AController,
      BController,
    ]);
  });
});

describe('controlerInventaire — le test sait échouer', () => {
  @Controller('x')
  class ExempleController {
    @Get('lecture')
    @Public()
    lecture(): void {}

    @Post('ecriture')
    @Public()
    ecriture(): void {}

    @Delete('suppression')
    @Public()
    suppression(): void {}

    @Get('cumul-roles')
    @Public()
    @Roles('ORGANISATEUR')
    cumulRoles(): void {}

    @Get('cumul-auth')
    @Public()
    @RequireAuth()
    cumulAuth(): void {}

    @Get('moi')
    @Public()
    moi(@CurrentUser() _utilisateur: unknown): void {}

    @Get('privee')
    privee(): void {}
  }

  const routes = listRoutes([ExempleController]);
  const route = (nom: string) => routes.filter((r) => r.handler === nom);

  it('une route publique hors liste échoue, avec son contrôleur (critère 11)', () => {
    expect(
      controlerInventaire(route('lecture'), {
        publicRoutes: [],
        publicWrites: [],
      }),
    ).toEqual([
      'Route publique hors PUBLIC_ROUTES : GET /x/lecture (ExempleController.lecture)',
    ]);
  });

  it('une route de la liste qui n’existe plus échoue', () => {
    expect(
      controlerInventaire([], {
        publicRoutes: ['GET /disparue'],
        publicWrites: [],
      }),
    ).toEqual(['PUBLIC_ROUTES périmée : GET /disparue']);
  });

  it('une route de la liste devenue privée échoue', () => {
    expect(
      controlerInventaire(route('privee'), {
        publicRoutes: ['GET /x/privee'],
        publicWrites: [],
      }),
    ).toEqual(['PUBLIC_ROUTES périmée : GET /x/privee']);
  });

  it.each([
    ['ecriture', 'POST /x/ecriture'],
    ['suppression', 'DELETE /x/suppression'],
  ])(
    'une écriture publique échoue, même inscrite dans la liste (critère 12) : %s',
    (nom, nomRoute) => {
      expect(
        controlerInventaire(route(nom), {
          publicRoutes: [nomRoute],
          publicWrites: [],
        }),
      ).toEqual([
        expect.stringContaining(
          `Écriture publique non autorisée : ${nomRoute}`,
        ),
      ]);
    },
  );

  it('une écriture nommée en exception passe', () => {
    expect(
      controlerInventaire(route('ecriture'), {
        publicRoutes: ['POST /x/ecriture'],
        publicWrites: ['POST /x/ecriture'],
      }),
    ).toEqual([]);
  });

  it.each(['cumulRoles', 'cumulAuth'])(
    'un cumul de décorateurs échoue (critère 4) : %s',
    (nom) => {
      expect(
        controlerInventaire(route(nom), { publicRoutes: [], publicWrites: [] }),
      ).toEqual([
        expect.stringContaining('@Public() combiné à une protection'),
      ]);
    },
  );

  it('@CurrentUser() sur une route publique échoue', () => {
    expect(
      controlerInventaire(route('moi'), {
        publicRoutes: ['GET /x/moi'],
        publicWrites: [],
      }),
    ).toEqual([
      expect.stringContaining('@CurrentUser() sur une route publique'),
    ]);
  });

  it('une route privée, hors liste, ne signale rien', () => {
    expect(
      controlerInventaire(route('privee'), {
        publicRoutes: [],
        publicWrites: [],
      }),
    ).toEqual([]);
  });
});
