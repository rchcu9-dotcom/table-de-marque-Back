import { IsInt, Max, Min } from 'class-validator';

export class AjouterAnneeAgeDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  annee: number;
}
