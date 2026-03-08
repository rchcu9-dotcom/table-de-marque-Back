import { IsDateString } from 'class-validator';

export class ValiderPaiementDto {
  @IsDateString()
  dateVirement: string;
}
