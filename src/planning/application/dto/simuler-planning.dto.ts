import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class SimulerPlanningDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  nbEquipesCible?: number;
}
