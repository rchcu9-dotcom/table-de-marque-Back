export class FormatPlace {
  constructor(
    public readonly id: number,
    public readonly groupeId: number,
    public readonly position: number,
    public readonly origine: 'ALIAS' | 'LIEE',
    public readonly aliasLabel: string | null,
    public readonly lienEntrantId: number | null,
  ) {}
}
