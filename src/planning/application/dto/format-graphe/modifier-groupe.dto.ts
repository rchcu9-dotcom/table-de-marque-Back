import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { FormatGroupeFormule } from '../../../domain/enums/format-groupe-formule.enum';

const FORMULES = Object.values(FormatGroupeFormule);

export class ModifierGroupeDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nom?: string;

  @IsOptional()
  @IsIn(FORMULES)
  formule?: FormatGroupeFormule;
}
