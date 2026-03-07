import { InscEquipeReferentiel } from '@prisma/client';
import { EquipeReferentiel } from '../../domain/entities/equipe-referentiel.entity';

export function toEquipeReferentielEntity(
  raw: InscEquipeReferentiel,
): EquipeReferentiel {
  return new EquipeReferentiel(
    raw.id,
    raw.nom,
    raw.logoUrl,
    raw.active,
    raw.createdAt,
    raw.updatedAt,
  );
}
