const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);
const mockPrismaClientCtor = jest.fn().mockImplementation(function (
  this: Record<string, unknown>,
) {
  this.$connect = mockConnect;
  this.$disconnect = mockDisconnect;
});

jest.mock('@prisma/client', () => ({
  PrismaClient: mockPrismaClientCtor,
}));

import { InscriptionPrismaService } from '@/inscription/infrastructure/persistence/inscription-prisma.service';

const ENV_KEYS = [
  'DATABASE_URL',
  'DB_HOST',
  'DB_USER',
  'DB_PASS',
  'DB_NAME',
  'DB_PORT',
] as const;

function lastCallOptions(): unknown {
  const calls = mockPrismaClientCtor.mock.calls;
  return calls[calls.length - 1][0];
}

describe('InscriptionPrismaService', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    mockPrismaClientCtor.mockClear();
    mockConnect.mockClear();
    mockDisconnect.mockClear();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('uses DATABASE_URL as-is when defined', () => {
    process.env.DATABASE_URL = 'mysql://user:pass@host:3306/db';

    new InscriptionPrismaService();

    expect(lastCallOptions()).toEqual({
      datasources: { db: { url: 'mysql://user:pass@host:3306/db' } },
    });
  });

  it('builds a mysql connection URL from DB_* env vars with URI-encoded credentials when DATABASE_URL is absent', () => {
    process.env.DB_HOST = 'db.example.com';
    process.env.DB_USER = 'user@name';
    process.env.DB_PASS = 'p@ss/word';
    process.env.DB_NAME = 'rchcu11 tournoi';

    new InscriptionPrismaService();

    expect(lastCallOptions()).toEqual({
      datasources: {
        db: {
          url: `mysql://${encodeURIComponent('user@name')}:${encodeURIComponent('p@ss/word')}@db.example.com:3306/${encodeURIComponent('rchcu11 tournoi')}`,
        },
      },
    });
  });

  it('uses DB_PORT instead of the default 3306 when provided', () => {
    process.env.DB_HOST = 'db.example.com';
    process.env.DB_USER = 'user';
    process.env.DB_NAME = 'db';
    process.env.DB_PORT = '3307';

    new InscriptionPrismaService();

    expect(lastCallOptions()).toEqual({
      datasources: { db: { url: 'mysql://user:@db.example.com:3307/db' } },
    });
  });

  it('passes empty options to PrismaClient when DB_HOST, DB_USER or DB_NAME is missing', () => {
    process.env.DB_USER = 'user';
    process.env.DB_NAME = 'db';
    // DB_HOST intentionally left unset

    new InscriptionPrismaService();

    expect(lastCallOptions()).toEqual({});
  });

  it('passes empty options to PrismaClient when DB_HOST is set but DB_USER and DB_NAME are missing', () => {
    process.env.DB_HOST = 'db.example.com';
    // DB_USER and DB_NAME intentionally left unset

    new InscriptionPrismaService();

    expect(lastCallOptions()).toEqual({});
  });

  it('connects on onModuleInit and disconnects on onModuleDestroy', async () => {
    process.env.DATABASE_URL = 'mysql://user:pass@host:3306/db';
    const service = new InscriptionPrismaService();

    await service.onModuleInit();
    expect(mockConnect).toHaveBeenCalledTimes(1);

    await service.onModuleDestroy();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});
