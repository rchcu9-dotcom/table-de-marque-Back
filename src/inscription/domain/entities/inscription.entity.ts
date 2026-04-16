import { InscriptionStatut } from '../enums/inscription-statut.enum';

export class Inscription {
  constructor(
    public readonly id: number,
    public readonly editionId: number,
    public readonly utilisateurId: number,
    public readonly equipeRefId: number | null,
    public readonly equipeNom: string,
    public readonly statut: InscriptionStatut,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
