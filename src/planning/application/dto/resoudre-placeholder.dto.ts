import { IsInt } from 'class-validator';

export class ResoudrePlaceholderDto {
  @IsInt()
  equipeId!: number;
}
