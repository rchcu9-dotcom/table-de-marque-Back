/** Équipe réelle (TaEquipe déjà synchronisée) ou fictive (en mémoire uniquement, jamais persistée). */
export class EquipeSimulation {
  constructor(
    public readonly ref: string, // clé stable pour la durée de la simulation ("real:<id>" ou "fictive:<n>")
    public readonly nom: string,
    public readonly fictive: boolean,
    public readonly equipeId: number | null, // TaEquipe.id réel, null si fictive
  ) {}
}
