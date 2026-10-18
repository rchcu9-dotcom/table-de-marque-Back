import { IsOptional, IsString, MaxLength } from 'class-validator';
import {
  NOM_COMPLET_MAX,
  NOM_COURT_MAX,
} from '../../../domain/equipe-referentiel-noms';

export class UpdateEquipeReferentielDto {
  @IsOptional()
  @IsString()
  @MaxLength(NOM_COURT_MAX)
  nom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOM_COMPLET_MAX)
  nomComplet?: string | null;
}
