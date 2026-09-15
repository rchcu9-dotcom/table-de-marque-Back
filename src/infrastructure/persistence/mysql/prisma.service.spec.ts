import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it('se connecte inconditionnellement au démarrage, même si aucun driver legacy ne vaut "prisma"', async () => {
    // Config par défaut documentée dans CLAUDE.md : aucun driver ne vaut
    // "prisma" (EQUIPE_REPOSITORY_DRIVER par défaut = google-sheets-public).
    // Le moteur de classement interne a besoin d'une connexion Prisma
    // inconditionnelle malgré cette config (cf. §Arch/§Dev du chantier).
    process.env.MATCH_REPOSITORY_DRIVER = 'google-sheets-public';
    process.env.EQUIPE_REPOSITORY_DRIVER = 'google-sheets-public';
    process.env.JOUEUR_REPOSITORY_DRIVER = 'memory';
    process.env.ATELIER_REPOSITORY_DRIVER = 'memory';
    process.env.TENTATIVE_ATELIER_REPOSITORY_DRIVER = 'memory';
    const connectSpy = jest
      .spyOn(PrismaService.prototype, '$connect')
      .mockResolvedValue(undefined);

    const service = new PrismaService();
    await service.onModuleInit();

    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it('se connecte aussi quand aucune variable de driver n\'est définie du tout', async () => {
    delete process.env.MATCH_REPOSITORY_DRIVER;
    delete process.env.EQUIPE_REPOSITORY_DRIVER;
    delete process.env.JOUEUR_REPOSITORY_DRIVER;
    delete process.env.ATELIER_REPOSITORY_DRIVER;
    delete process.env.TENTATIVE_ATELIER_REPOSITORY_DRIVER;
    const connectSpy = jest
      .spyOn(PrismaService.prototype, '$connect')
      .mockResolvedValue(undefined);

    const service = new PrismaService();
    await service.onModuleInit();

    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it('se déconnecte sur onModuleDestroy', async () => {
    const disconnectSpy = jest
      .spyOn(PrismaService.prototype, '$disconnect')
      .mockResolvedValue(undefined);
    const service = new PrismaService();

    await service.onModuleDestroy();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
