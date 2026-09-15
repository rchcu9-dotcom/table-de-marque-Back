import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
} from 'class-validator';
import { FormatPhaseFinale } from '../../../domain/enums/format-phase-finale.enum';

const PRESETS = Object.values(FormatPhaseFinale);

export class GenererPresetDto {
  @IsIn(PRESETS)
  preset: FormatPhaseFinale;

  @IsInt()
  @IsPositive()
  nbPoules: number;

  @IsInt()
  @IsPositive()
  nbEquipesParPoule: number;

  @IsInt()
  @IsPositive()
  nbEquipesQualifieesParPoule: number;

  @IsOptional()
  @IsBoolean()
  forcer?: boolean;
}
