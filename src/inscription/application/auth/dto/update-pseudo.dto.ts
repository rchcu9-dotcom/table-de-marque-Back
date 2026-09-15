import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdatePseudoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  pseudo: string;
}
