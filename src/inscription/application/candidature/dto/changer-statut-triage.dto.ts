import { IsIn } from 'class-validator';

export type StatutTriageCible =
  | 'PAIEMENT_ATTENDU'
  | 'LISTE_ATTENTE'
  | 'REFUSEE';

export class ChangerStatutTriageDto {
  @IsIn(['PAIEMENT_ATTENDU', 'LISTE_ATTENTE', 'REFUSEE'])
  statut: StatutTriageCible;
}
