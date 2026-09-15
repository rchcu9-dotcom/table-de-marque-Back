export class Dossier {
  constructor(
    public readonly id: number,
    public readonly inscriptionId: number,
    public readonly dateVirementInscription: Date | null,
    public readonly dateReceptionInscription: Date | null,
    public readonly datePaiementRepas: Date | null,
    public readonly dateReceptionRepas: Date | null,
    public readonly repasPaiementRecu: boolean,
    public readonly droitsImageAcceptes: boolean,
    public readonly droitsImageHorodatage: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
