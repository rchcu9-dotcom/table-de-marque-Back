import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class AjouterPenaliteDto {
  @IsInt()
  @IsPositive()
  equipeId: number;

  @IsInt()
  @IsPositive()
  joueurId: number;

  @IsString()
  @IsNotEmpty()
  typePenaliteCode: string;

  @IsInt()
  @IsPositive()
  dureeMinutes: number;

  @IsInt()
  @IsPositive()
  tempsJeuDebut: number;
}
