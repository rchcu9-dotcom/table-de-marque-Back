import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class AjusterSimulationDto {
  @IsOptional()
  @Type(() => Date)
  dateHeure?: Date;

  @IsOptional()
  @IsString()
  equipe1Ref?: string;

  @IsOptional()
  @IsString()
  equipe2Ref?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  dureeMin?: number;
}
