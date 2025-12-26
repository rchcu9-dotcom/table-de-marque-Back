import { IsString, IsDateString, IsOptional, IsIn } from 'class-validator';

export class CreateMatchDto {
  @IsDateString()
  date: string;

  @IsString()
  teamA: string;

  @IsString()
  teamB: string;

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
