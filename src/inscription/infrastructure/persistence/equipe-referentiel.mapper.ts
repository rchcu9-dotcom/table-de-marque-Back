import { InscEquipeReferentiel } from '@prisma/client';
import { EquipeReferentiel } from '../../domain/entities/equipe-referentiel.entity';
import { resoudreLogoEquipe } from '../../domain/equipe-referentiel-logo';

export function toEquipeReferentielEntity(
  raw: InscEquipeReferentiel,
  candidatureEnCours = false,
  nbCandidatures = 0,
): EquipeReferentiel {
  return new EquipeReferentiel(
    raw.id,
    raw.nom,
    raw.nomComplet,
    resoudreLogoEquipe(raw.logoUrl, raw.nom),
    raw.active,
    raw.createdAt,
    raw.updatedAt,
    candidatureEnCours,
    nbCandidatures,
  );
}
