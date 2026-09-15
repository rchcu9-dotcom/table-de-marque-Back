import { IsInt, Min } from 'class-validator';

export class EditerChronoDto {
  @IsInt()
  @Min(0)
  tempsEcouleSecondes: number;
}
