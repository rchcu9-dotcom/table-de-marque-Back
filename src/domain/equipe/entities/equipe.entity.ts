// Poule code is usually 'A' or 'B' but allow any string to stay flexible across tournaments.
export type PouleCode = string;

export class Equipe {
  constructor(
    public id: string,
    public name: string,
    public logoUrl: string | null,
    public pouleCode: PouleCode,
    public pouleName: string,
    public rang: number,
    public joues: number,
    public victoires: number,
    public nuls: number,
    public defaites: number,
    public points: number,
    public bp: number,
    public bc: number,
    public diff: number,
  ) {}
}

export type PouleClassement = {
  pouleCode: PouleCode;
  pouleName: string;
  equipes: Equipe[];
};
