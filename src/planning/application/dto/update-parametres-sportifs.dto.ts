import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsArray,
  IsString,
} from 'class-validator';
import { FormatPhaseFinale } from '../../domain/enums/format-phase-finale.enum';

const FORMATS_PHASE_FINALE = Object.values(FormatPhaseFinale);

export class UpdateParametresSportifsDto {
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
  @IsInt()
  dureeInterMatchMin?: number | null;

  @IsOptional()
  @IsObject()
  delaiMinActivite?: Record<string, Record<string, number>> | null;

  @IsOptional()
  @IsInt()
  nbPatinoires?: number | null;

  @IsOptional()
  @IsInt()
  nbPoules?: number | null;

  @IsOptional()
  @IsInt()
  nbEquipesParPoule?: number | null;

  @IsOptional()
  @IsInt()
  nbEquipesQualifieesParPoule?: number | null;

  @IsOptional()
  @IsIn(FORMATS_PHASE_FINALE)
  formatPhaseFinale?: FormatPhaseFinale | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reglesTieBreak?: string[] | null;
}
