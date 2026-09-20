import { IsBoolean, IsDateString, IsEnum, ValidateIf } from 'class-validator';
import { ModePaiementRepas } from '@prisma/client';

export class MarquerPaiementRepasDto {
  @IsBoolean()
  paye: boolean;

  // Date et mode de règlement obligatoires quand on marque le repas comme payé ;
  // ignorés (et remis à null) quand on revient en arrière.
  @ValidateIf((o: MarquerPaiementRepasDto) => o.paye === true)
  @IsDateString()
  datePaiement?: string;

  @ValidateIf((o: MarquerPaiementRepasDto) => o.paye === true)
  @IsEnum(ModePaiementRepas)
  mode?: ModePaiementRepas;
}
