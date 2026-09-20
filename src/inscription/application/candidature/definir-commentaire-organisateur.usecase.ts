import { Injectable, NotFoundException } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { DefinirCommentaireOrganisateurDto } from './dto/definir-commentaire-organisateur.dto';

export interface DefinirCommentaireOrganisateurResult {
  id: number;
  commentaireOrganisateur: string | null;
}

@Injectable()
export class DefinirCommentaireOrganisateurUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(
    id: number,
    dto: DefinirCommentaireOrganisateurDto,
  ): Promise<DefinirCommentaireOrganisateurResult> {
    const inscription = await this.prisma.inscInscription.findUnique({
      where: { id },
    });
    if (!inscription) {
      throw new NotFoundException('Candidature non trouvée');
    }

    const commentaire = dto.commentaire.trim();
    const updated = await this.prisma.inscInscription.update({
      where: { id },
      data: { commentaireOrganisateur: commentaire === '' ? null : commentaire },
    });

    return {
      id: updated.id,
      commentaireOrganisateur: updated.commentaireOrganisateur,
    };
  }
}
