import { Injectable } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { Utilisateur } from '../../domain/entities/utilisateur.entity';
import { toUtilisateurEntity } from '../../infrastructure/persistence/utilisateur.mapper';

export interface UpsertUtilisateurDto {
  providerUid: string;
  email: string;
  displayName: string;
}

@Injectable()
export class UpsertUtilisateurUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(dto: UpsertUtilisateurDto): Promise<Utilisateur> {
    // Branche 1 : match par providerUid — update email/displayName uniquement (jamais role)
    const byProviderUid = await this.prisma.inscUtilisateur.findUnique({
      where: { providerUid: dto.providerUid },
    });
    if (byProviderUid) {
      const updated = await this.prisma.inscUtilisateur.update({
        where: { providerUid: dto.providerUid },
        data: {
          email: dto.email,
          displayName: dto.displayName || null,
        },
      });
      return toUtilisateurEntity(updated);
    }

    // Branche 2 (repli D3) : match par email — relie le compte pré-migration
    if (dto.email) {
      const byEmail = await this.prisma.inscUtilisateur.findFirst({
        where: { email: dto.email },
      });
      if (byEmail) {
        const updated = await this.prisma.inscUtilisateur.update({
          where: { id: byEmail.id },
          data: {
            providerUid: dto.providerUid,
            provider: 'google',
            email: dto.email,
            displayName: dto.displayName || null,
          },
        });
        return toUtilisateurEntity(updated);
      }
    }

    // Branche 3 : création (premier login)
    const created = await this.prisma.inscUtilisateur.create({
      data: {
        providerUid: dto.providerUid,
        provider: 'google',
        email: dto.email,
        displayName: dto.displayName || null,
        role: 'RESPONSABLE_EQUIPE',
      },
    });
    return toUtilisateurEntity(created);
  }
}
