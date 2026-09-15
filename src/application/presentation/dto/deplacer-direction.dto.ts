import { IsIn } from 'class-validator';
import type { DeplacerDirection } from '@/domain/presentation/repositories/presentation-article.repository';

export class DeplacerDirectionDto {
  @IsIn(['haut', 'bas'])
  direction: DeplacerDirection;
}
