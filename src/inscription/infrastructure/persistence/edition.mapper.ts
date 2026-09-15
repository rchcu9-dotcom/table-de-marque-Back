import { InscEdition } from '@prisma/client';
import { Edition } from '../../domain/entities/edition.entity';
import { EditionEtape } from '../../domain/enums/edition-etape.enum';

export type InscEditionAvecAnneesAge = InscEdition & {
  anneesAge: { annee: number }[];
};

export function toEditionEntity(raw: InscEditionAvecAnneesAge): Edition {
  return new Edition(
    raw.id,
    raw.nom,
    raw.categorie,
    raw.annee,
    raw.etape as EditionEtape,
    raw.dateDebut,
    raw.dateFinDebut,
    raw.dateFinFin,
    Number(raw.fraisInscription),
    Number(raw.prixRepas),
    raw.nbPlacesMax,
    raw.imageUrl,
    raw.imageDossierUrl,
    raw.imageRibUrl,
    raw.contactEmail,
    raw.contactPhone,
    raw.dureeSurfacageMin,
    raw.dureeMatchPouleMin,
    raw.dureeMatchFinalMin,
    raw.affichagePlanningPublic,
    raw.msgBienvenue,
    raw.msgFaisonsConnaissance,
    raw.msgSelectionEquipe,
    raw.msgAjoutEquipe,
    raw.msgInscriptionEnCours,
    raw.msgInscriptionValidee,
    raw.msgLancerDemande,
    raw.msgDemandeSoumise,
    raw.msgEquipeRefusee,
    raw.msgListeAttente,
    raw.msgPaiementAttendu,
    raw.msgChequeInfo1,
    raw.msgChequeInfo2,
    raw.msgInscriptionConfirmee,
    raw.msgRenseigneJoueurs,
    raw.anneesAge.map((a) => a.annee).sort((a, b) => a - b),
    raw.createdAt,
    raw.updatedAt,
  );
}
