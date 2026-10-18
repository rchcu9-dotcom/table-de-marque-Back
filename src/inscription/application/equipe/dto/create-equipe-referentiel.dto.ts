import { IsOptional, IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { NOM_COMPLET_MAX } from '../../../domain/equipe-referentiel-noms';

export class CreateEquipeReferentielDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOM_COMPLET_MAX)
  nomComplet?: string | null;

  @IsOptional()
  @IsString()
  logoUrl?: string | null;
}
