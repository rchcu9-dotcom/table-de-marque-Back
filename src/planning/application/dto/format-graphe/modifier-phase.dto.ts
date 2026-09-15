import { IsString, MaxLength } from 'class-validator';

export class ModifierPhaseDto {
  @IsString()
  @MaxLength(60)
  nom: string;
}
