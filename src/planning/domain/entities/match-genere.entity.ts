export type PhaseCompetition = 'BRASSAGE' | 'QUALIFICATION' | 'FINALE';

export class MatchGenere {
  constructor(
    public readonly numMatch: number,
    public readonly jour: number,
    public readonly matchCase: number,
    public readonly equipe1Ref: string,
    public readonly equipe1Nom: string,
    public readonly equipe2Ref: string,
    public readonly equipe2Nom: string,
    public readonly dateHeure: Date,
    public readonly dureeMin: number,
    public readonly is3v3: boolean,
    public readonly poule: string | null,
    public readonly phase: PhaseCompetition,
    /**
     * Pour un match de bracket (ELIMINATION_DIRECTE) : la ref
     * (`placeholder:vainqueur-tT-mM`) que le vainqueur DE CE MATCH doit
     * satisfaire au tour suivant. `null` si ce match ne produit aucun
     * vainqueur consommé ailleurs (brassage, ou formats sans chaînage).
     * Seul moyen de relier plus tard un `PlanningMatchSlot.numMatchSource`
     * à ce match — cette info n'existe qu'ici, en mémoire pendant la
     * génération (cf. spec "lors-du-déroulement-live..." §2).
     */
    public readonly refVainqueurProduit: string | null = null,
    /**
     * Id du FormatGroupe qui a produit ce match (null pour les matchs générés
     * par l'ancien moteur GenerationMatchsService en mode de compatibilité).
     */
    public readonly groupeId: number | null = null,
    /**
     * Pour un match d'un Groupe à 2 places (MATCH_UNIQUE) : la ref
     * (`placeholder:groupe-{id}-rang-2`) que le PERDANT de ce match doit
     * satisfaire dans le Groupe cible du tableau "basse" (haute/basse).
     * `null` si le rang 2 de ce match n'a pas de lien sortant LIE (rang
     * terminal ELIMINE, ou match hors modèle graphe).
     */
    public readonly refPerdantProduit: string | null = null,
  ) {}
}
