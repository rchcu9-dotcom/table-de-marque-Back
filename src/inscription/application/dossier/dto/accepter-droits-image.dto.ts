import { IsBoolean } from 'class-validator';

export class AccepterDroitsImageDto {
  @IsBoolean()
  accepte: boolean;
}
