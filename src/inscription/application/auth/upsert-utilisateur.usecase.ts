import { Injectable } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { Utilisateur } from '../../domain/entities/utilisateur.entity';
import { toUtilisateurEntity } from '../../infrastructure/persistence/utilisateur.mapper';

export interface UpsertUtilisateurDto {
  uid: string;
  email: string;
  name: string;
}

@Injectable()
export class UpsertUtilisateurUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(dto: UpsertUtilisateurDto): Promise<Utilisateur> {
    const utilisateur = await this.prisma.inscUtilisateur.upsert({
      where: { firebaseUid: dto.uid },
      update: {
        email: dto.email,
        displayName: dto.name || null,
      },
      create: {
        firebaseUid: dto.uid,
        email: dto.email,
        displayName: dto.name || null,
        role: 'RESPONSABLE_EQUIPE',
      },
    });

    return toUtilisateurEntity(utilisateur);
  }
}
