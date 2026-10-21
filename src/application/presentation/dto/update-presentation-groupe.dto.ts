import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Aligné sur la colonne `presentation_articles.groupe_image_url` (VARCHAR(500)). */
export const PRESENTATION_IMAGE_URL_MAX_LENGTH = 500;

export class UpdatePresentationGroupeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nom?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  nomEn?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  dureeMs?: number;

  // `null` (champ vidé dans l'admin) reste accepté : il retire l'image du chapitre.
  @IsOptional()
  @IsString()
  @MaxLength(PRESENTATION_IMAGE_URL_MAX_LENGTH, {
    message: "L'URL de l'image ne doit pas dépasser 500 caractères.",
  })
  @Matches(/^https?:\/\/\S+$/i, {
    message: "L'URL de l'image doit commencer par http:// ou https://.",
  })
  imageUrl?: string | null;
}
