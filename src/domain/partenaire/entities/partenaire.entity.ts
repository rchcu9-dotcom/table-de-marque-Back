export class Partenaire {
  constructor(
    public id: number,
    public nom: string,
    public logoUrl: string | null,
    public urlSite: string | null,
    public type: 'naming' | 'general',
    public namingGroup: 'A' | 'B' | 'C' | 'D' | null,
    public ordre: number,
  ) {}
}
