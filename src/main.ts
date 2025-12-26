import * as dotenv from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Load .env.local if present, fallback to .env
dotenv.config({ path: '.env.local' });
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const envOrigins = process.env.CORS_ORIGINS;
  const defaultOrigins = [
    "http://localhost:5173",
    "https://sttablemarque.z6.web.core.windows.net",
    "https://table-de-marque-72e86.web.app",
    "https://table-de-marque-72e86.firebaseapp.com",
  ];

  const origins = envOrigins
    ? envOrigins.split(",").map((o) => o.trim()).filter(Boolean)
    : defaultOrigins;

  app.enableCors({ origin: origins });

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
