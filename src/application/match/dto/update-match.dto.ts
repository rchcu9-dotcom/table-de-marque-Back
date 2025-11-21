import { IsString, IsOptional, IsDateString } from 'class-validator';

export class UpdateMatchDto {
  @IsOptional()
  @IsString()
  teamA?: string;

  @IsOptional()
  @IsString()
  teamB?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
