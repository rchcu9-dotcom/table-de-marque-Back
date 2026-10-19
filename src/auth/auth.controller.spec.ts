import { ForbiddenException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { InscUtilisateur } from '@prisma/client';
import { AuthController } from './auth.controller';
import type { AuthPrismaService } from './auth-prisma.service';

function utilisateur(overrides: Partial<InscUtilisateur> = {}): InscUtilisateur {
  return {
    id: 1,
    providerUid: 'dev-coach@example.com',
    provider: 'dev',
    email: 'coach@example.com',
    displayName: 'Coach',
    pseudo: null,
    role: 'RESPONSABLE_EQUIPE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as InscUtilisateur;
}

describe('AuthController.devLogin', () => {
  const dto = { email: 'coach@example.com', displayName: 'Coach' };
  let prisma: {
    inscUtilisateur: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
  };
  let jwt: { signAsync: jest.Mock };
  let controller: AuthController;
  const envInitial = { ...process.env };

  beforeEach(() => {
    prisma = {
      inscUtilisateur: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('jeton') };
    controller = new AuthController(
      jwt as unknown as JwtService,
      prisma as unknown as AuthPrismaService,
    );
    process.env.ENABLE_DEV_LOGIN = 'true';
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...envInitial };
  });

  it.each([undefined, 'false', ''])(
    'refuse quand ENABLE_DEV_LOGIN=%p, même hors production',
    async (valeur) => {
      if (valeur === undefined) delete process.env.ENABLE_DEV_LOGIN;
      else process.env.ENABLE_DEV_LOGIN = valeur;

      await expect(controller.devLogin(dto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.inscUtilisateur.findUnique).not.toHaveBeenCalled();
    },
  );

  it('crée un compte dev RESPONSABLE_EQUIPE au premier login', async () => {
    prisma.inscUtilisateur.create.mockResolvedValue(utilisateur());

    await expect(controller.devLogin(dto)).resolves.toEqual({
      token: 'jeton',
    });
    expect(prisma.inscUtilisateur.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerUid: 'dev-coach@example.com',
        provider: 'dev',
        role: 'RESPONSABLE_EQUIPE',
      }),
    });
  });

  it("refuse de reprendre par email un compte existant (pas de repli D3)", async () => {
    prisma.inscUtilisateur.findFirst.mockResolvedValue(
      utilisateur({
        id: 7,
        providerUid: 'google-123',
        provider: 'google',
        role: 'ORGANISATEUR',
      }),
    );

    await expect(controller.devLogin(dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.inscUtilisateur.update).not.toHaveBeenCalled();
    expect(prisma.inscUtilisateur.create).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it.each(['ORGANISATEUR', 'TABLE_DE_MARQUE'])(
    'refuse un compte dev promu %s',
    async (role) => {
      prisma.inscUtilisateur.findUnique.mockResolvedValue(
        utilisateur({ role: role as InscUtilisateur['role'] }),
      );

      await expect(controller.devLogin(dto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.inscUtilisateur.update).not.toHaveBeenCalled();
      expect(jwt.signAsync).not.toHaveBeenCalled();
    },
  );

  it("reconnecte un compte dev RESPONSABLE_EQUIPE sans toucher à l'email ni au rôle", async () => {
    prisma.inscUtilisateur.findUnique.mockResolvedValue(utilisateur());
    prisma.inscUtilisateur.update.mockResolvedValue(utilisateur());

    await expect(controller.devLogin(dto)).resolves.toEqual({
      token: 'jeton',
    });
    expect(prisma.inscUtilisateur.update).toHaveBeenCalledWith({
      where: { providerUid: 'dev-coach@example.com' },
      data: { displayName: 'Coach' },
    });
    expect(prisma.inscUtilisateur.findFirst).not.toHaveBeenCalled();
  });
});
