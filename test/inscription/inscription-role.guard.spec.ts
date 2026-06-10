import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { InscriptionRoleGuard } from '@/inscription/infrastructure/http/inscription-role.guard';
import type { InscriptionPrismaService } from '@/inscription/infrastructure/persistence/inscription-prisma.service';
import { ROLES_KEY } from '@/auth/decorators/roles.decorator';

interface MockRequest {
  user?: { uid?: string; email?: string; name?: string };
}

function makeContext(user?: MockRequest['user']): {
  context: ExecutionContext;
  request: MockRequest;
} {
  const request: MockRequest = user !== undefined ? { user } : {};
  const handler = function handler() {};
  class TestController {}
  const context = {
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
  return { context, request };
}

function makeReflector(requiredRoles: string[] | undefined): {
  reflector: Reflector;
  getAllAndOverride: jest.Mock;
} {
  const getAllAndOverride = jest.fn().mockReturnValue(requiredRoles);
  return {
    reflector: { getAllAndOverride } as unknown as Reflector,
    getAllAndOverride,
  };
}

function makePrisma(findUnique: jest.Mock): InscriptionPrismaService {
  return {
    inscUtilisateur: { findUnique },
  } as unknown as InscriptionPrismaService;
}

describe('InscriptionRoleGuard', () => {
  it('grants access without querying Prisma when no @Roles metadata is present', async () => {
    const findUnique = jest.fn();
    const { reflector, getAllAndOverride } = makeReflector(undefined);
    const guard = new InscriptionRoleGuard(reflector, makePrisma(findUnique));
    const { context } = makeContext({ uid: 'user-1' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
    expect(getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      expect.any(Function),
      expect.any(Function),
    ]);
  });

  it('grants access without querying Prisma when @Roles is an empty array', async () => {
    const findUnique = jest.fn();
    const { reflector } = makeReflector([]);
    const guard = new InscriptionRoleGuard(reflector, makePrisma(findUnique));
    const { context } = makeContext({ uid: 'user-1' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when request.user is missing', async () => {
    const findUnique = jest.fn();
    const { reflector } = makeReflector(['ORGANISATEUR']);
    const guard = new InscriptionRoleGuard(reflector, makePrisma(findUnique));
    const { context } = makeContext(undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when request.user.uid is missing', async () => {
    const findUnique = jest.fn();
    const { reflector } = makeReflector(['ORGANISATEUR']);
    const guard = new InscriptionRoleGuard(reflector, makePrisma(findUnique));
    const { context } = makeContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when no InscUtilisateur matches the firebase uid', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const { reflector } = makeReflector(['ORGANISATEUR']);
    const guard = new InscriptionRoleGuard(reflector, makePrisma(findUnique));
    const { context } = makeContext({ uid: 'inconnu-1' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(findUnique).toHaveBeenCalledWith({
      where: { firebaseUid: 'inconnu-1' },
      select: { role: true },
    });
  });

  it('throws ForbiddenException when the InscUtilisateur role is not in requiredRoles', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValue({ role: 'RESPONSABLE_EQUIPE' });
    const { reflector } = makeReflector(['ORGANISATEUR']);
    const guard = new InscriptionRoleGuard(reflector, makePrisma(findUnique));
    const { context } = makeContext({ uid: 'responsable-1' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('grants access when the InscUtilisateur role is in requiredRoles', async () => {
    const findUnique = jest.fn().mockResolvedValue({ role: 'ORGANISATEUR' });
    const { reflector } = makeReflector(['ORGANISATEUR']);
    const guard = new InscriptionRoleGuard(reflector, makePrisma(findUnique));
    const { context } = makeContext({ uid: 'organisateur-1' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
