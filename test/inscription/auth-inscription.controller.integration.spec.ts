import request from 'supertest';
import { AuthInscriptionController } from '@/inscription/infrastructure/http/auth-inscription.controller';
import { UpdatePseudoUseCase } from '@/inscription/application/auth/update-pseudo.usecase';
import {
  buildInscriptionTestApp,
  givenRole,
  type InscriptionTestApp,
} from './support/inscription-test-app';

describe('AuthInscriptionController (integration)', () => {
  let testApp: InscriptionTestApp;

  const updatePseudoUseCase = { execute: jest.fn() };

  beforeAll(async () => {
    testApp = await buildInscriptionTestApp(
      [AuthInscriptionController],
      [{ provide: UpdatePseudoUseCase, useValue: updatePseudoUseCase }],
    );
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /inscription/auth/me', () => {
    it('returns 401 without authentication', async () => {
      await request(testApp.app.getHttpServer())
        .get('/inscription/auth/me')
        .expect(401);
    });

    it('returns id/pseudo/role for the authenticated user', async () => {
      givenRole(testApp.prisma, 'RESPONSABLE_EQUIPE');

      const res = await request(testApp.app.getHttpServer())
        .get('/inscription/auth/me')
        .set('Authorization', 'Bearer responsable-1')
        .expect(200);

      expect(res.body).toEqual({
        id: 1,
        pseudo: null,
        role: 'RESPONSABLE_EQUIPE',
      });
    });
  });

  describe('PATCH /inscription/auth/pseudo', () => {
    it('returns 401 without authentication and does not call the use case', async () => {
      await request(testApp.app.getHttpServer())
        .patch('/inscription/auth/pseudo')
        .send({ pseudo: 'MikeTrout99' })
        .expect(401);

      expect(updatePseudoUseCase.execute).not.toHaveBeenCalled();
    });

    it('returns 200 and persists the pseudo for the authenticated user', async () => {
      givenRole(testApp.prisma, 'RESPONSABLE_EQUIPE');
      updatePseudoUseCase.execute.mockResolvedValue({
        id: 1,
        pseudo: 'MikeTrout99',
        role: 'RESPONSABLE_EQUIPE',
      });

      const res = await request(testApp.app.getHttpServer())
        .patch('/inscription/auth/pseudo')
        .set('Authorization', 'Bearer responsable-1')
        .send({ pseudo: 'MikeTrout99' })
        .expect(200);

      expect(res.body).toEqual({
        id: 1,
        pseudo: 'MikeTrout99',
        role: 'RESPONSABLE_EQUIPE',
      });
      expect(updatePseudoUseCase.execute).toHaveBeenCalledWith(
        'responsable-1',
        { pseudo: 'MikeTrout99' },
      );
    });
  });
});
