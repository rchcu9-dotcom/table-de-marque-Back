import { CreneauActiviteStatut } from '../enums/creneau-activite-statut.enum';

export class CreneauActivite {
  constructor(
    public readonly id: number,
    public readonly editionId: number,
    public readonly activiteId: number,
    public readonly date: Date,
    public readonly heureDebut: Date,
    public readonly dureeMin: number,
    public readonly equipeId: number | null,
    public readonly equipeLabel: string | null,
    public readonly statut: CreneauActiviteStatut,
    public readonly createdAt: Date,
  ) {}
}
