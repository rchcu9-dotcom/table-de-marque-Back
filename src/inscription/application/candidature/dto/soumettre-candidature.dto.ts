import { IsInt, IsPositive } from 'class-validator';

export class SoumettreCanditatureDto {
  @IsInt()
  @IsPositive()
  equipeRefId: number;
}
