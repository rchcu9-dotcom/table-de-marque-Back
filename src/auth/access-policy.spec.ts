import { Reflector } from '@nestjs/core';
import {
  hasConflictingAccess,
  readAccessMetadata,
  resolveAccess,
  type AccessMetadata,
} from './access-policy';
import { Public } from './decorators/public.decorator';
import { RequireAuth } from './decorators/require-auth.decorator';
import { Roles } from './decorators/roles.decorator';

describe('resolveAccess (critère 5)', () => {
  it('@Roles non vide : rôles exigés', () => {
    expect(resolveAccess({ roles: ['ORGANISATEUR'] })).toEqual({
      roles: ['ORGANISATEUR'],
    });
  });

  it('@RequireAuth : token exigé', () => {
    expect(resolveAccess({ requireAuth: true })).toBe('authenticated');
  });

  it('@Public seul : accès libre', () => {
    expect(resolveAccess({ isPublic: true })).toBe('public');
  });

  it('aucune métadonnée : token exigé, et non accès libre', () => {
    expect(resolveAccess({})).toBe('authenticated');
  });

  it('@Roles() sans rôle : token exigé, jamais public', () => {
    expect(resolveAccess({ roles: [] })).toBe('authenticated');
  });

  it('valeurs explicitement fausses : token exigé', () => {
    expect(
      resolveAccess({ isPublic: false, requireAuth: false, roles: [] }),
    ).toBe('authenticated');
  });

  it('@Public + @Roles : la protection l’emporte', () => {
    expect(resolveAccess({ isPublic: true, roles: ['ORGANISATEUR'] })).toEqual({
      roles: ['ORGANISATEUR'],
    });
  });

  it('@Public + @RequireAuth : la protection l’emporte', () => {
    expect(resolveAccess({ isPublic: true, requireAuth: true })).toBe(
      'authenticated',
    );
  });

  it('@RequireAuth + @Roles : les rôles restent exigés', () => {
    expect(
      resolveAccess({ requireAuth: true, roles: ['TABLE_DE_MARQUE'] }),
    ).toEqual({ roles: ['TABLE_DE_MARQUE'] });
  });
});

describe('hasConflictingAccess', () => {
  it.each<[AccessMetadata, boolean]>([
    [{}, false],
    [{ isPublic: true }, false],
    [{ isPublic: true, roles: [] }, false],
    [{ requireAuth: true }, false],
    [{ roles: ['ORGANISATEUR'] }, false],
    [{ requireAuth: true, roles: ['ORGANISATEUR'] }, false],
    [{ isPublic: true, requireAuth: true }, true],
    [{ isPublic: true, roles: ['ORGANISATEUR'] }, true],
  ])('%j → %s', (metadata, attendu) => {
    expect(hasConflictingAccess(metadata)).toBe(attendu);
  });
});

describe('readAccessMetadata', () => {
  @Roles('ORGANISATEUR')
  class ClasseRoles {
    @Public()
    publique(): void {}

    @Roles('TABLE_DE_MARQUE')
    surcharge(): void {}

    herite(): void {}
  }

  @Public()
  class ClassePublique {
    @RequireAuth()
    authentifiee(): void {}

    herite(): void {}
  }

  const reflector = new Reflector();
  const proto = ClasseRoles.prototype;

  it('lit la classe quand la méthode ne dit rien', () => {
    expect(readAccessMetadata(reflector, [proto.herite, ClasseRoles])).toEqual({
      isPublic: undefined,
      requireAuth: undefined,
      roles: ['ORGANISATEUR'],
    });
  });

  it('la méthode a priorité sur la classe', () => {
    expect(
      readAccessMetadata(reflector, [proto.surcharge, ClasseRoles]).roles,
    ).toEqual(['TABLE_DE_MARQUE']);
  });

  it('cumule méthode et classe quand les clés diffèrent', () => {
    const metadata = readAccessMetadata(reflector, [
      proto.publique,
      ClasseRoles,
    ]);

    expect(metadata).toMatchObject({
      isPublic: true,
      roles: ['ORGANISATEUR'],
    });
    expect(resolveAccess(metadata)).toEqual({ roles: ['ORGANISATEUR'] });
  });

  it('lit @Public de classe', () => {
    expect(
      readAccessMetadata(reflector, [
        ClassePublique.prototype.herite,
        ClassePublique,
      ]).isPublic,
    ).toBe(true);
  });

  it('une classe @Public avec une méthode @RequireAuth reste protégée', () => {
    expect(
      resolveAccess(
        readAccessMetadata(reflector, [
          ClassePublique.prototype.authentifiee,
          ClassePublique,
        ]),
      ),
    ).toBe('authenticated');
  });
});
