import {
  InscDossier,
  InscJoueurDossier,
  InscCoachDossier,
} from '@prisma/client';
import { Dossier } from '../../domain/entities/dossier.entity';
import { JoueurDossier } from '../../domain/entities/joueur-dossier.entity';
import { CoachDossier } from '../../domain/entities/coach-dossier.entity';

export function toDossierEntity(raw: InscDossier): Dossier {
  return new Dossier(
    raw.id,
    raw.inscriptionId,
    raw.dateVirementInscription,
    raw.dateReceptionInscription,
    raw.datePaiementRepas,
    raw.dateReceptionRepas,
    raw.repasPaiementRecu,
    raw.droitsImageAcceptes,
    raw.droitsImageHorodatage,
    raw.createdAt,
    raw.updatedAt,
  );
}

export function toJoueurDossierEntity(raw: InscJoueurDossier): JoueurDossier {
  return new JoueurDossier(
    raw.id,
    raw.dossierId,
    raw.nom,
    raw.prenom,
    raw.numero,
    raw.poste,
    raw.licenceFFH,
    raw.anneeNaissance,
    raw.particularitesAlim,
    raw.createdAt,
    raw.updatedAt,
  );
}

export function toCoachDossierEntity(raw: InscCoachDossier): CoachDossier {
  return new CoachDossier(
    raw.id,
    raw.dossierId,
    raw.nom,
    raw.prenom,
    raw.presenceRepas,
    raw.createdAt,
    raw.updatedAt,
  );
}
