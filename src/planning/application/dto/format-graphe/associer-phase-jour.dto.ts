import { IsInt, IsPositive } from 'class-validator';

export class AssocierPhaseJourDto {
  @IsInt()
  @IsPositive()
  editionJourId: number;
}
