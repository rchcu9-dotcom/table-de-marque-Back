import { IsBoolean, IsOptional } from 'class-validator';

export class ConfirmerPlanningDto {
  @IsOptional()
  @IsBoolean()
  forcerEquipesFictives?: boolean;
}
