import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class CreateEquipeReferentielDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsOptional()
  @IsString()
  logoUrl?: string | null;
}
