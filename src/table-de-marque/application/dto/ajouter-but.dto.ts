import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class AjouterButDto {
  @IsInt()
  @IsPositive()
  equipeId: number;

  @IsInt()
  @IsPositive()
  buteurId: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  assist1Id?: number | null;

  @IsOptional()
  @IsInt()
  @IsPositive()
  assist2Id?: number | null;

  @IsInt()
  @IsPositive()
  tempsJeuSecondes: number;
}
