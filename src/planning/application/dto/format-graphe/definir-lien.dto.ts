import { IsInt, IsPositive } from 'class-validator';

export class DefinirLienDto {
  @IsInt()
  @IsPositive()
  groupeCibleId: number;
}
