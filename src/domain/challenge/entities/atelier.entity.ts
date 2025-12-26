export type AtelierType = 'vitesse' | 'tir' | 'glisse_crosse';

export class Atelier {
  constructor(
    public id: string,
    public label: string,
    public type: AtelierType,
    public phase: string,
    public ordre: number,
  ) {}
}
