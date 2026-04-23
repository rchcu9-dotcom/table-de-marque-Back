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
    public repasSamedi: string | null = null,
    public repasDimanche: string | null = null,
    public challengeSamedi: string | null = null,
    public photoUrl: string | null = null,
    public repasLundi: string | null = null,
    public ordre: number | null = null,
    public ordreFinal: number | null = null,
  ) {}
}

export type PouleClassement = {
  pouleCode: PouleCode;
  pouleName: string;
  phase?: string | null;
  equipes: Equipe[];
};
