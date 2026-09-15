import { IsInt, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreerPhaseDto {
  @IsString()
  @MaxLength(60)
  nom: string;

  @IsInt()
  @IsPositive()
  ordre: number;
}
