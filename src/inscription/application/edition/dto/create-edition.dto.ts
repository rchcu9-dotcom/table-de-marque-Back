import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EDITION_ETAPES } from '../../../domain/enums/edition-etape.enum';
import type { EditionEtape } from '../../../domain/enums/edition-etape.enum';

export class CreateEditionDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsString()
  @IsNotEmpty()
  categorie: string;

  @IsInt()
  annee: number;

  @IsOptional()
  @IsIn(EDITION_ETAPES)
  etape?: EditionEtape;

  /**
   * Optionnel depuis le cycle annuel de l'édition (docs/specs/title-cycle-
   * annuel-de-ldition-dump-obligatoire-prparation-de.md §5.2) : le
   * formulaire "Créer la nouvelle édition" ne collecte que nom/catégorie/
   * année ; CreateEditionUseCase pose une date de bootstrap par défaut
   * (1er janvier de `annee`) quand ce champ est omis.
   */
  @IsOptional()
  @Type(() => Date)
  dateDebut?: Date;

  @IsOptional()
  @Type(() => Date)
  dateFinDebut?: Date;

  @IsOptional()
  @Type(() => Date)
  dateFinFin?: Date;

  @IsOptional()
  @IsNumber()
  fraisInscription?: number;

  @IsOptional()
  @IsNumber()
  prixRepas?: number;

  @IsOptional()
  @IsInt()
  nbPlacesMax?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  imageDossierUrl?: string | null;

  @IsOptional()
  @IsString()
  imageRibUrl?: string | null;

  @IsOptional()
  @IsString()
  contactEmail?: string | null;

  @IsOptional()
  @IsString()
  contactPhone?: string | null;

  @IsOptional()
  @IsInt()
  dureeSurfacageMin?: number;

  @IsOptional()
  @IsInt()
  dureeMatchPouleMin?: number;

  @IsOptional()
  @IsInt()
  dureeMatchFinalMin?: number;

  @IsOptional()
  @IsBoolean()
  affichagePlanningPublic?: boolean;

  @IsOptional()
  @IsString()
  msgBienvenue?: string | null;

  @IsOptional()
  @IsString()
  msgFaisonsConnaissance?: string | null;

  @IsOptional()
  @IsString()
  msgSelectionEquipe?: string | null;

  @IsOptional()
  @IsString()
  msgAjoutEquipe?: string | null;

  @IsOptional()
  @IsString()
  msgInscriptionEnCours?: string | null;

  @IsOptional()
  @IsString()
  msgInscriptionValidee?: string | null;

  @IsOptional()
  @IsString()
  msgLancerDemande?: string | null;

  @IsOptional()
  @IsString()
  msgDemandeSoumise?: string | null;

  @IsOptional()
  @IsString()
  msgEquipeRefusee?: string | null;

  @IsOptional()
  @IsString()
  msgListeAttente?: string | null;

  @IsOptional()
  @IsString()
  msgPaiementAttendu?: string | null;

  @IsOptional()
  @IsString()
  msgChequeInfo1?: string | null;

  @IsOptional()
  @IsString()
  msgChequeInfo2?: string | null;

  @IsOptional()
  @IsString()
  msgInscriptionConfirmee?: string | null;

  @IsOptional()
  @IsString()
  msgRenseigneJoueurs?: string | null;
}
