import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import type { OAuthProfile } from '@rchcu9-dotcom/auth-passport-back';
import type { Request, Response } from 'express';
import type { InscUtilisateur } from '@prisma/client';
import { GoogleConfiguredGuard } from './google-configured.guard';
import { AuthPrismaService } from './auth-prisma.service';
import { DevLoginDto } from './dto/dev-login.dto';

interface LocalJwtPayload {
  sub: string; // providerUid
  email: string;
  displayName?: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authPrisma: AuthPrismaService,
  ) {}

  @Get('google')
  @UseGuards(GoogleConfiguredGuard, AuthGuard('google'))
  googleLogin(): void {
    // Passport redirige vers Google ; aucun corps de réponse à produire ici.
  }

  @Get('google/callback')
  @UseGuards(GoogleConfiguredGuard, AuthGuard('google'))
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const profile = req.user as OAuthProfile;

    const utilisateur = await this.upsertUtilisateur(
      profile.providerId,
      'google',
      profile.email ?? '',
      profile.displayName ?? '',
    );

    const token = await this.signToken(utilisateur);
    const frontUrl = process.env.FRONT_URL ?? 'http://localhost:5173';
    res.redirect(`${frontUrl}/auth/callback?token=${token}`);
  }

  /**
   * Connexion de secours pour tester l'application en local sans configurer de vrai
   * client OAuth Google. Désactivée par défaut en production (cf. ENABLE_DEV_LOGIN).
   *
   * Ne prouvant jamais la possession de l'email fourni, cette route ne peut JAMAIS
   * accorder un rôle privilégié (ORGANISATEUR / TABLE_DE_MARQUE).
   */
  @Post('dev-login')
  async devLogin(@Body() dto: DevLoginDto): Promise<{ token: string }> {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ENABLE_DEV_LOGIN !== 'true'
    ) {
      throw new ForbiddenException('dev-login désactivé en production');
    }

    const providerUid = `dev-${dto.email}`;
    const utilisateur = await this.upsertUtilisateur(
      providerUid,
      'dev',
      dto.email,
      dto.displayName,
    );

    const token = await this.signToken(utilisateur);
    return { token };
  }

  /**
   * Implémente le mécanisme de repli D3 :
   * 1. Match par providerUid → update email/displayName (jamais role)
   * 2. Repli par email → relie le compte pré-migration (conserve id/role/pseudo)
   * 3. Create (premier login)
   */
  private async upsertUtilisateur(
    providerUid: string,
    provider: string,
    email: string,
    displayName: string,
  ): Promise<InscUtilisateur> {
    // Branche 1
    const byProviderUid = await this.authPrisma.inscUtilisateur.findUnique({
      where: { providerUid },
    });
    if (byProviderUid) {
      return this.authPrisma.inscUtilisateur.update({
        where: { providerUid },
        data: { email, displayName: displayName || null },
      });
    }

    // Branche 2 (repli D3)
    if (email) {
      const byEmail = await this.authPrisma.inscUtilisateur.findFirst({
        where: { email },
      });
      if (byEmail) {
        return this.authPrisma.inscUtilisateur.update({
          where: { id: byEmail.id },
          data: {
            providerUid,
            provider,
            email,
            displayName: displayName || null,
          },
        });
      }
    }

    // Branche 3
    return this.authPrisma.inscUtilisateur.create({
      data: {
        providerUid,
        provider,
        email,
        displayName: displayName || null,
        role: 'RESPONSABLE_EQUIPE',
      },
    });
  }

  private async signToken(utilisateur: InscUtilisateur): Promise<string> {
    const payload: LocalJwtPayload = {
      sub: utilisateur.providerUid,
      email: utilisateur.email,
      displayName: utilisateur.displayName ?? undefined,
    };
    return this.jwtService.signAsync(payload);
  }
}
