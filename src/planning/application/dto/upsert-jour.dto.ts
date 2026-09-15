import { IsDate, IsIn, IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

const TYPES_JOURNEE = ['5V5', '3V3', 'MIXTE'] as const;

export class UpsertJourDto {
  @IsInt()
  @IsPositive()
  numeroJour: number;

  @IsDate()
  @Type(() => Date)
  date: Date;

  @IsDate()
  @Type(() => Date)
  heureDebut: Date;

  @IsDate()
  @Type(() => Date)
  heureFin: Date;

  @IsIn(TYPES_JOURNEE)
  typeJournee: (typeof TYPES_JOURNEE)[number];
}
