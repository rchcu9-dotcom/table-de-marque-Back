import { Body, Controller, Get, Patch } from '@nestjs/common';
import { UpdatePseudoUseCase } from '../../application/auth/update-pseudo.usecase';
import { UpdatePseudoDto } from '../../application/auth/dto/update-pseudo.dto';
import { RequireAuth } from '../../../auth/decorators/require-auth.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../../auth/decorators/current-user.decorator';

@Controller('inscription/auth')
export class AuthInscriptionController {
  constructor(private readonly updatePseudo: UpdatePseudoUseCase) {}

  /**
   * Retourne le profil de l'utilisateur connecté (id, pseudo, role).
   * L'upsert a déjà eu lieu dans AuthController.googleCallback —
   * ce endpoint lit simplement le CurrentUser résolu par AuthGuard.
   */
  @Get('me')
  @RequireAuth()
  me(@CurrentUser() currentUser: CurrentUserPayload): {
    id: number;
    pseudo: string | null;
    role: string;
  } {
    return {
      id: currentUser.id,
      pseudo: currentUser.pseudo ?? null,
      role: currentUser.role,
    };
  }

  @Patch('pseudo')
  @RequireAuth()
  async setPseudo(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: UpdatePseudoDto,
  ): Promise<{ id: number; pseudo: string | null; role: string }> {
    const utilisateur = await this.updatePseudo.execute(
      currentUser.providerUid,
      dto,
    );

    return {
      id: utilisateur.id,
      pseudo: utilisateur.pseudo ?? null,
      role: utilisateur.role,
    };
  }
}
