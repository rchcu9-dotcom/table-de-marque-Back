import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

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

  @IsOptional()
  @IsString()
  imageUrl?: string | null;
}
