export class FormatLien {
  constructor(
    public readonly id: number,
    public readonly groupeSourceId: number,
    public readonly rangSource: number,
    public readonly etat: 'NON_DEFINI' | 'ELIMINE' | 'LIE',
    public readonly groupeCibleId: number | null,
    public readonly placeCibleId: number | null,
  ) {}
}
