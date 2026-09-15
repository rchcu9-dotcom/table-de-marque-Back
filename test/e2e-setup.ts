import * as dotenv from 'dotenv';
import * as path from 'path';

// Les specs e2e instancient directement des modules Nest (Test.createTestingModule)
// sans jamais exécuter src/main.ts, donc le dotenv.config() qui y vit n'est jamais
// atteint : sans ce setup, DATABASE_URL (et le reste de .env.local) n'existe pas
// dans process.env pendant ces tests, alors que PrismaService se connecte de façon
// inconditionnelle au démarrage de tout module qui importe PersistenceModule.
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config();
