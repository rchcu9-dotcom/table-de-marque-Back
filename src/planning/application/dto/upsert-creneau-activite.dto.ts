import { IsDateString, IsInt, Min } from 'class-validator';

export class UpsertCreneauActiviteDto {
  @IsInt()
  activiteId: number;

  @IsDateString()
  date: string;

  @IsDateString()
  heureDebut: string;

  @IsInt()
  @Min(1)
  dureeMin: number;
}
