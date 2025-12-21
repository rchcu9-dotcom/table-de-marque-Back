import * as dotenv from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Load .env.local if present, fallback to .env
dotenv.config({ path: '.env.local' });
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const ENV = process.env.NODE_ENV;

  app.enableCors({
    origin:
      ENV === 'production'
        ? [
            'https://table-de-marque-72e86.web.app',
            'https://table-de-marque-72e86.firebaseapp.com',
          ]
        : 'http://localhost:5173',
  });

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
