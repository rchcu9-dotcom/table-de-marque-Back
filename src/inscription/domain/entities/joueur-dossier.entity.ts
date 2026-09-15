export class JoueurDossier {
  constructor(
    public readonly id: number,
    public readonly dossierId: number,
    public readonly nom: string,
    public readonly prenom: string,
    public readonly numero: number,
    public readonly poste: string,
    public readonly licenceFFH: string | null,
    public readonly anneeNaissance: number | null,
    public readonly particularitesAlim: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
