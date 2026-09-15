import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import {
  AuthService,
  GoogleOAuthStrategy,
} from '@rchcu9-dotcom/auth-passport-back';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthPrismaService } from './auth-prisma.service';
import { GoogleConfiguredGuard } from './google-configured.guard';

/**
 * JWT_SECRET est obligatoire : son absence doit faire échouer le démarrage
 * plutôt que de signer des tokens avec un secret connu/versionné dans le code.
 */
function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET est requis (aucun secret de fallback) : positionnez cette variable d'environnement (cf. back/.env.local).",
    );
  }
  return secret;
}

@Global()
@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: requireJwtSecret(),
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ||
          '7d') as `${number}${'d' | 'h' | 'm' | 's'}`,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleOAuthStrategy,
    AuthPrismaService,
    AuthGuard,
    GoogleConfiguredGuard,
  ],
  exports: [AuthGuard, AuthPrismaService],
})
export class AuthModule {}
