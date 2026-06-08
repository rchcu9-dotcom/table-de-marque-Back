import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type * as admin from 'firebase-admin';
import { FirebaseAuthGuard } from '@/auth/firebase-auth.guard';

interface MockRequest {
  headers: { authorization?: string };
  user?: { uid: string; email: string; name: string };
}

function makeContext(authHeader?: string): {
  context: ExecutionContext;
  request: MockRequest;
} {
  const request: MockRequest = {
    headers: authHeader ? { authorization: authHeader } : {},
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
  return { context, request };
}

function makeFirebaseApp(verifyIdToken: jest.Mock): admin.app.App {
  return {
    auth: () => ({ verifyIdToken }),
  } as unknown as admin.app.App;
}

describe('FirebaseAuthGuard', () => {
  it('rejects requests without an Authorization header', async () => {
    const guard = new FirebaseAuthGuard(makeFirebaseApp(jest.fn()));
    const { context } = makeContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects requests whose Authorization header is not a Bearer token', async () => {
    const guard = new FirebaseAuthGuard(makeFirebaseApp(jest.fn()));
    const { context } = makeContext('Basic dXNlcjpwYXNz');

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('verifies the token, attaches the user to the request and grants access', async () => {
    const verifyIdToken = jest.fn().mockResolvedValue({
      uid: 'user-1',
      email: 'coach@example.com',
      name: 'Coach Test',
    });
    const guard = new FirebaseAuthGuard(makeFirebaseApp(verifyIdToken));
    const { context, request } = makeContext('Bearer valid-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(verifyIdToken).toHaveBeenCalledWith('valid-token');
    expect(request.user).toEqual({
      uid: 'user-1',
      email: 'coach@example.com',
      name: 'Coach Test',
    });
  });

  it('falls back to display_name and empty strings when claims are missing', async () => {
    const verifyIdToken = jest.fn().mockResolvedValue({
      uid: 'user-2',
      display_name: 'Display Name',
    });
    const guard = new FirebaseAuthGuard(makeFirebaseApp(verifyIdToken));
    const { context, request } = makeContext('Bearer another-token');

    await guard.canActivate(context);

    expect(request.user).toEqual({
      uid: 'user-2',
      email: '',
      name: 'Display Name',
    });
  });

  it('rejects requests when the Firebase token cannot be verified', async () => {
    const verifyIdToken = jest.fn().mockRejectedValue(new Error('expired'));
    const guard = new FirebaseAuthGuard(makeFirebaseApp(verifyIdToken));
    const { context } = makeContext('Bearer expired-token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
