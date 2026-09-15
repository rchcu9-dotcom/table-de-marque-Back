import { IsString, MaxLength } from 'class-validator';

export class AjouterPlaceAliasDto {
  @IsString()
  @MaxLength(60)
  aliasLabel: string;
}
