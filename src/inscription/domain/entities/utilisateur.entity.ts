import { UtilisateurRole } from '../enums/utilisateur-role.enum';

export class Utilisateur {
  constructor(
    public readonly id: number,
    public readonly firebaseUid: string,
    public readonly email: string,
    public readonly displayName: string | null,
    public readonly pseudo: string | null,
    public readonly role: UtilisateurRole,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
