import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateEditionDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  categorie?: string;

  @IsOptional()
  @IsInt()
  annee?: number;

  @IsOptional()
  @IsString()
  etape?: string;

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
  @Type(() => Date)
  dateDbutRepas?: Date | null;

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
