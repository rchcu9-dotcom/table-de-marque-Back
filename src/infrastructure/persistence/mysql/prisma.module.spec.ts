import { Test } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { InscriptionModule } from '@/inscription/inscription.module';
import { InscriptionPrismaService } from '@/inscription/infrastructure/persistence/inscription-prisma.service';
import { PlanningModule } from '@/planning/infrastructure/http/planning.module';
import { PlanningPrismaService } from '@/planning/infrastructure/persistence/planning-prisma.service';
import { TableDeMarqueModule } from '@/table-de-marque/infrastructure/http/table-de-marque.module';
import { TableDeMarquePrismaService } from '@/table-de-marque/infrastructure/persistence/table-de-marque-prisma.service';

// Un PrismaClient = un pool de connexions : les modules doivent tous partager le même,
// sinon chaque instance Cloud Run multiplie ses connexions MySQL (max_user_connections).
describe('PrismaModule — client Prisma unique', () => {
  // Les fabriques de PersistenceModule choisissent leur source selon ces variables ;
  // `prisma` évite d'exiger les URL Google Sheets. Rien ne se connecte : compile()
  // n'appelle pas onModuleInit.
  const DRIVERS = [
    'MATCH_REPOSITORY_DRIVER',
    'EQUIPE_REPOSITORY_DRIVER',
    'JOUEUR_REPOSITORY_DRIVER',
    'MEALS_REPOSITORY_DRIVER',
    'ATELIER_REPOSITORY_DRIVER',
    'TENTATIVE_ATELIER_REPOSITORY_DRIVER',
    'PRESENTATION_REPOSITORY_DRIVER',
  ];
  const envAvant = { ...process.env };

  beforeAll(() => {
    for (const nom of DRIVERS) process.env[nom] = 'prisma';
  });

  afterAll(() => {
    process.env = envAvant;
  });

  it('Inscription, Planning et TableDeMarque reçoivent la même instance que PrismaService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [InscriptionModule, PlanningModule, TableDeMarqueModule],
    }).compile();

    const partage = moduleRef.get(PrismaService, { strict: false });

    expect(moduleRef.get(InscriptionPrismaService, { strict: false })).toBe(
      partage,
    );
    expect(moduleRef.get(PlanningPrismaService, { strict: false })).toBe(
      partage,
    );
    expect(
      moduleRef.get(TableDeMarquePrismaService, { strict: false }),
    ).toBe(partage);

    await moduleRef.close();
  });
});
