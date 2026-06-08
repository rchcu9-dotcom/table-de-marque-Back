import * as admin from 'firebase-admin';
import {
  firebaseAdminProvider,
  FIREBASE_ADMIN,
} from '@/auth/firebase-admin.provider';

jest.mock('firebase-admin', () => ({
  apps: [] as unknown[],
  initializeApp: jest.fn(() => ({ name: 'initialized-app' })),
  credential: {
    cert: jest.fn(() => 'cert-credential'),
    applicationDefault: jest.fn(() => 'application-default-credential'),
  },
}));

const mockedAdmin = admin as unknown as {
  apps: unknown[];
  initializeApp: jest.Mock;
  credential: { cert: jest.Mock; applicationDefault: jest.Mock };
};

describe('firebaseAdminProvider', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAdmin.apps.length = 0;
    process.env = { ...envBackup };
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  });

  afterAll(() => {
    process.env = envBackup;
  });

  it('exposes the FIREBASE_ADMIN injection token', () => {
    expect(firebaseAdminProvider.provide).toBe(FIREBASE_ADMIN);
  });

  it('reuses an already initialized Firebase app instead of creating a new one', () => {
    const existingApp = { name: 'existing-app' };
    mockedAdmin.apps.push(existingApp);

    const app = firebaseAdminProvider.useFactory();

    expect(app).toBe(existingApp);
    expect(mockedAdmin.initializeApp).not.toHaveBeenCalled();
  });

  it('initializes the app from FIREBASE_SERVICE_ACCOUNT_JSON when provided', () => {
    const serviceAccount = {
      project_id: 'rchcu11',
      client_email: 'svc@rchcu11.iam',
    };
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(serviceAccount);

    const app = firebaseAdminProvider.useFactory();

    expect(mockedAdmin.credential.cert).toHaveBeenCalledWith(serviceAccount);
    expect(mockedAdmin.initializeApp).toHaveBeenCalledWith({
      credential: 'cert-credential',
    });
    expect(app).toEqual({ name: 'initialized-app' });
  });

  it('falls back to application default credentials when no service account is configured', () => {
    const app = firebaseAdminProvider.useFactory();

    expect(mockedAdmin.credential.applicationDefault).toHaveBeenCalled();
    expect(mockedAdmin.credential.cert).not.toHaveBeenCalled();
    expect(mockedAdmin.initializeApp).toHaveBeenCalledWith({
      credential: 'application-default-credential',
    });
    expect(app).toEqual({ name: 'initialized-app' });
  });
});
