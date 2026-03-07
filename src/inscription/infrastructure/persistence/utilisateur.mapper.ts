import {
  InscUtilisateur,
  UtilisateurRole as PrismaUtilisateurRole,
} from '@prisma/client';
import { Utilisateur } from '../../domain/entities/utilisateur.entity';
import { UtilisateurRole } from '../../domain/enums/utilisateur-role.enum';

function toRole(prismaRole: PrismaUtilisateurRole): UtilisateurRole {
  return prismaRole === 'ORGANISATEUR'
    ? UtilisateurRole.ORGANISATEUR
    : UtilisateurRole.RESPONSABLE_EQUIPE;
}

export function toUtilisateurEntity(raw: InscUtilisateur): Utilisateur {
  return new Utilisateur(
    raw.id,
    raw.firebaseUid,
    raw.email,
    raw.displayName,
    raw.pseudo,
    toRole(raw.role),
    raw.createdAt,
    raw.updatedAt,
  );
}
