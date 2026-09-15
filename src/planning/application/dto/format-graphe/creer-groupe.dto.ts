import { IsString, MaxLength } from 'class-validator';

export class CreerGroupeDto {
  @IsString()
  @MaxLength(60)
  nom: string;
}
