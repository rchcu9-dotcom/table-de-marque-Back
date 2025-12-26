import { IsString, IsOptional, IsDateString, IsIn } from 'class-validator';

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

  @IsOptional()
  @IsIn(['5v5', '3v3', 'challenge'])
  competitionType?: '5v5' | '3v3' | 'challenge';

  @IsOptional()
  @IsIn(['GG', 'PG'])
  surface?: 'GG' | 'PG';

  @IsOptional()
  @IsIn(['brassage', 'qualification', 'finales'])
  phase?: 'brassage' | 'qualification' | 'finales';

  @IsOptional()
  @IsIn(['J1', 'J2', 'J3'])
  jour?: 'J1' | 'J2' | 'J3';
}
