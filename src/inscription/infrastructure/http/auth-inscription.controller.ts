import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { UpsertUtilisateurUseCase } from '../../application/auth/upsert-utilisateur.usecase';
import { Inject } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FIREBASE_ADMIN } from '../../../auth/firebase-admin.provider';

interface MeBody {
  firebaseToken: string;
}

@Controller('inscription/auth')
export class AuthInscriptionController {
  constructor(
    private readonly upsertUtilisateur: UpsertUtilisateurUseCase,
    @Inject(FIREBASE_ADMIN) private readonly firebaseApp: admin.app.App,
  ) {}

  @Post('me')
  async me(
    @Body() body: MeBody,
  ): Promise<{ id: number; pseudo: string | null; role: string }> {
    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await this.firebaseApp.auth().verifyIdToken(body.firebaseToken);
    } catch {
      throw new UnauthorizedException('Token Firebase invalide ou expiré');
    }

    const utilisateur = await this.upsertUtilisateur.execute({
      uid: decoded.uid,
      email: decoded.email ?? '',
      name: (decoded.name ?? '') as string,
    });

    return {
      id: utilisateur.id,
      pseudo: utilisateur.pseudo ?? null,
      role: utilisateur.role,
    };
  }
}
