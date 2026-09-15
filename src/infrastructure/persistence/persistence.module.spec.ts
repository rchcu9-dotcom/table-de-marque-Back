import { Test } from '@nestjs/testing';
import {
  EQUIPE_REPOSITORY,
  EQUIPE_REPOSITORY_LEGACY,
} from '@/domain/equipe/repositories/equipe.repository';
import { PersistenceModule } from './persistence.module';
import { ClassementInterneEquipeRepository } from './mysql/classement-interne-equipe.repository';

describe('PersistenceModule — câblage EQUIPE_REPOSITORY (chantier classement live)', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('résout EQUIPE_REPOSITORY vers le décorateur ClassementInterneEquipeRepository, distinct du legacy', async () => {
    // Driver "memory" : évite la dépendance à GOOGLE_SHEETS_CLASSEMENT_CSV_URL
    // requise par le driver par défaut (google-sheets-public), non liée au
    // câblage testé ici. Compile le graphe de DI réel de PersistenceModule
    // (sans appeler onModuleInit/$connect) : valide que le nouveau câblage
    // ne casse pas la résolution des providers (tokens, ordre d'injection).
    process.env.EQUIPE_REPOSITORY_DRIVER = 'memory';
    const moduleRef = await Test.createTestingModule({
      imports: [PersistenceModule],
    }).compile();

    const equipeRepository = moduleRef.get(EQUIPE_REPOSITORY);
    const legacyRepository = moduleRef.get(EQUIPE_REPOSITORY_LEGACY);

    expect(equipeRepository).toBeInstanceOf(ClassementInterneEquipeRepository);
    expect(legacyRepository).toBeDefined();
    expect(legacyRepository).not.toBe(equipeRepository);

    await moduleRef.close();
  });

  it('reste résoluble quand EQUIPE_REPOSITORY_DRIVER vaut "prisma" (driver legacy alternatif)', async () => {
    process.env.EQUIPE_REPOSITORY_DRIVER = 'prisma';

    const moduleRef = await Test.createTestingModule({
      imports: [PersistenceModule],
    }).compile();

    const equipeRepository = moduleRef.get(EQUIPE_REPOSITORY);

    expect(equipeRepository).toBeInstanceOf(ClassementInterneEquipeRepository);

    await moduleRef.close();
  });
});
