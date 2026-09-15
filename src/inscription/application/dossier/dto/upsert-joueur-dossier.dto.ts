import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { POSTES_JOUEUR } from '../../../domain/enums/poste-joueur.enum';
import type { PosteJoueur } from '../../../domain/enums/poste-joueur.enum';

export class CreateJoueurDossierDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  prenom: string;

  @IsInt()
  @IsPositive()
  numero: number;

  @IsIn(POSTES_JOUEUR)
  poste: PosteJoueur;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  licenceFFH?: string | null;

  // Année d'âge obligatoire (spec "l'année d'age n'est pas optionnelle"),
  // validée en plus contre la liste configurée pour l'édition dans
  // AjouterJoueurUseCase (AnneeAgeValidationService) — @IsInt() seul ne
  // garantit qu'un entier syntaxiquement valide.
  @IsInt()
  anneeNaissance: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  particularitesAlim?: string | null;
}

export class UpdateJoueurDossierDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  prenom?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  numero?: number;

  @IsOptional()
  @IsIn(POSTES_JOUEUR)
  poste?: PosteJoueur;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  licenceFFH?: string | null;

  // Reste optionnel au niveau HTTP (sémantique PATCH partiel) : la garantie
  // de non-nullité en base porte sur la création, pas sur l'update partiel.
  @IsOptional()
  @IsInt()
  anneeNaissance?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  particularitesAlim?: string | null;
}
