import * as dotenv from 'dotenv';

// Doit s'exécuter avant l'import d'AppModule : certains modules (ex. AuthModule)
// lisent process.env de façon synchrone dès leur chargement (métadonnées de
// décorateur @Module), donc avant même le démarrage de Nest.
dotenv.config({ path: '.env.local' });
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { configureHttpSecurity } from './infrastructure/http/security/http-security';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  configureHttpSecurity(app);

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap().catch((err) => {
  console.error('Fatal bootstrap error', err);
});
