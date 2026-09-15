export class ArticlePresentation {
  constructor(
    public readonly groupe: string,
    public readonly groupeEn: string,
    public readonly titre: string,
    public readonly titreEn: string,
    public readonly description: string,
    public readonly descriptionEn: string,
    public readonly imageUrl: string | null,
    public readonly lienUrl: string | null,
    public readonly lieu: string | null,
    public readonly mapsQuery: string | null,
    /** Court label affiché au-dessus du titre (« Résumé », « Inscriptions »…). */
    public readonly surtitre: string = '',
    public readonly surtitreEn: string = '',
    /** Chiffres-clés, une par ligne au format `valeur|libellé`. */
    public readonly faits: string = '',
    public readonly faitsEn: string = '',
    /** Titre choc affiché en grand (3-4 mots) — remplace `titre` sur la page publique. */
    public readonly titreAccroche: string = '',
    public readonly titreAccrocheEn: string = '',
    /** Résumé de 3 lignes max affiché sous le titre choc — remplace `description` sur la page publique. */
    public readonly descriptionCourte: string = '',
    public readonly descriptionCourteEn: string = '',
  ) {}
}

export class PresentationGroupe {
  constructor(
    public readonly nom: string,
    public readonly nomEn: string,
    public readonly articles: ArticlePresentation[],
    public readonly ordre: number,
    public readonly dureeMs: number,
    public readonly imageUrl: string | null,
  ) {}
}
