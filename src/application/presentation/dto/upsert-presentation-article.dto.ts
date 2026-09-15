import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class UpsertPresentationArticleDto {
  @IsString()
  @MinLength(1)
  groupe: string;

  @IsString()
  @MinLength(1)
  groupeEn: string;

  @IsOptional()
  @IsString()
  surtitre?: string;

  @IsOptional()
  @IsString()
  surtitreEn?: string;

  @IsOptional()
  @IsString()
  faits?: string;

  @IsOptional()
  @IsString()
  faitsEn?: string;

  @IsString()
  @MinLength(1)
  titre: string;

  @IsString()
  @MinLength(1)
  titreEn: string;

  @IsString()
  description: string;

  @IsString()
  descriptionEn: string;

  @IsOptional()
  @IsString()
  titreAccroche?: string;

  @IsOptional()
  @IsString()
  titreAccrocheEn?: string;

  @IsOptional()
  @IsString()
  descriptionCourte?: string;

  @IsOptional()
  @IsString()
  descriptionCourteEn?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  lienUrl?: string | null;

  @IsOptional()
  @IsString()
  lieu?: string | null;

  @IsOptional()
  @IsString()
  mapsQuery?: string | null;

  @IsInt()
  ordre: number;
}
