export class PresentationArticleRecord {
  constructor(
    public readonly id: number,
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
    public readonly ordre: number,
    public readonly groupeOrdre: number,
    public readonly groupeDureeMs: number,
    public readonly groupeImageUrl: string | null,
    public readonly surtitre: string = '',
    public readonly surtitreEn: string = '',
    public readonly faits: string = '',
    public readonly faitsEn: string = '',
    public readonly titreAccroche: string = '',
    public readonly titreAccrocheEn: string = '',
    public readonly descriptionCourte: string = '',
    public readonly descriptionCourteEn: string = '',
  ) {}
}

export const PRESENTATION_ARTICLE_REPOSITORY =
  'PRESENTATION_ARTICLE_REPOSITORY';

export type PresentationArticleData = {
  groupe: string;
  groupeEn: string;
  surtitre: string;
  surtitreEn: string;
  faits: string;
  faitsEn: string;
  titre: string;
  titreEn: string;
  description: string;
  descriptionEn: string;
  titreAccroche: string;
  titreAccrocheEn: string;
  descriptionCourte: string;
  descriptionCourteEn: string;
  imageUrl: string | null;
  lienUrl: string | null;
  lieu: string | null;
  mapsQuery: string | null;
  ordre: number;
  groupeOrdre: number;
  groupeDureeMs: number;
  groupeImageUrl: string | null;
};

export type DeplacerDirection = 'haut' | 'bas';

export type PresentationGroupeMetaUpdate = {
  nom?: string;
  nomEn?: string;
  dureeMs?: number;
  imageUrl?: string | null;
};

export interface PresentationArticleRepository {
  findAllOrdered(): Promise<PresentationArticleRecord[]>;
  create(data: PresentationArticleData): Promise<PresentationArticleRecord>;
  update(
    id: number,
    data: PresentationArticleData,
  ): Promise<PresentationArticleRecord>;
  delete(id: number): Promise<void>;
  updateGroupeMeta(
    groupe: string,
    data: PresentationGroupeMetaUpdate,
  ): Promise<void>;
  deplacerGroupe(groupe: string, direction: DeplacerDirection): Promise<void>;
  deplacerArticle(id: number, direction: DeplacerDirection): Promise<void>;
  deleteGroupe(groupe: string): Promise<void>;
}
