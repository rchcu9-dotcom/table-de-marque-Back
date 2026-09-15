import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class UpsertActiviteCatalogueDto {
  @IsString()
  @MinLength(1)
  label: string;

  @IsInt()
  @Min(1)
  dureeParEquipeMin: number;

  @IsInt()
  @Min(1)
  capaciteParallele: number;
}
