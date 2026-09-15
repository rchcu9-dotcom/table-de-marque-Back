import { Injectable, NotFoundException } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { Utilisateur } from '../../domain/entities/utilisateur.entity';
import { toUtilisateurEntity } from '../../infrastructure/persistence/utilisateur.mapper';
import { UpdatePseudoDto } from './dto/update-pseudo.dto';

@Injectable()
export class UpdatePseudoUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(
    providerUid: string,
    dto: UpdatePseudoDto,
  ): Promise<Utilisateur> {
    const utilisateur = await this.prisma.inscUtilisateur.findUnique({
      where: { providerUid },
    });
    if (!utilisateur) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const updated = await this.prisma.inscUtilisateur.update({
      where: { providerUid },
      data: { pseudo: dto.pseudo.trim() },
    });

    return toUtilisateurEntity(updated);
  }
}
