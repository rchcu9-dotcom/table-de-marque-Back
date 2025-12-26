export type Poste = 'Att' | 'Def' | 'Gar';

export class Joueur {
  constructor(
    public id: string,
    public equipeId: string,
    public nom: string,
    public numero: number,
    public poste: Poste,
  ) {}
}
