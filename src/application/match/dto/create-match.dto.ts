import { IsString, IsDateString } from 'class-validator';

export class CreateMatchDto {
  @IsDateString()
  date: string;

  @IsString()
  teamA: string;

  @IsString()
  teamB: string;
}
