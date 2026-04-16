import { Injectable } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { Edition } from '../../domain/entities/edition.entity';
import { toEditionEntity } from '../../infrastructure/persistence/edition.mapper';
import { CreateEditionDto } from './dto/create-edition.dto';

export { CreateEditionDto };

@Injectable()
export class CreateEditionUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(dto: CreateEditionDto): Promise<Edition> {
    const edition = await this.prisma.inscEdition.create({
      data: {
        nom: dto.nom,
        categorie: dto.categorie,
        annee: dto.annee,
        etape: dto.etape ?? 'CREEE',
        dateDebut: dto.dateDebut,
        dateFinDebut: dto.dateFinDebut,
        dateFinFin: dto.dateFinFin,
        dateDbutRepas: dto.dateDbutRepas ?? null,
        fraisInscription: dto.fraisInscription,
        prixRepas: dto.prixRepas,
        nbPlacesMax: dto.nbPlacesMax ?? 16,
        imageUrl: dto.imageUrl ?? null,
        imageDossierUrl: dto.imageDossierUrl ?? null,
        imageRibUrl: dto.imageRibUrl ?? null,
        contactEmail: dto.contactEmail ?? null,
        contactPhone: dto.contactPhone ?? null,
        dureeSurfacageMin: dto.dureeSurfacageMin ?? 20,
        dureeMatchPouleMin: dto.dureeMatchPouleMin ?? 27,
        dureeMatchFinalMin: dto.dureeMatchFinalMin ?? 33,
        affichagePlanningPublic: dto.affichagePlanningPublic ?? false,
        msgBienvenue: dto.msgBienvenue ?? null,
        msgFaisonsConnaissance: dto.msgFaisonsConnaissance ?? null,
        msgSelectionEquipe: dto.msgSelectionEquipe ?? null,
        msgAjoutEquipe: dto.msgAjoutEquipe ?? null,
        msgInscriptionEnCours: dto.msgInscriptionEnCours ?? null,
        msgInscriptionValidee: dto.msgInscriptionValidee ?? null,
        msgLancerDemande: dto.msgLancerDemande ?? null,
        msgDemandeSoumise: dto.msgDemandeSoumise ?? null,
        msgListeAttente: dto.msgListeAttente ?? null,
        msgPaiementAttendu: dto.msgPaiementAttendu ?? null,
        msgChequeInfo1: dto.msgChequeInfo1 ?? null,
        msgChequeInfo2: dto.msgChequeInfo2 ?? null,
        msgInscriptionConfirmee: dto.msgInscriptionConfirmee ?? null,
        msgRenseigneJoueurs: dto.msgRenseigneJoueurs ?? null,
      },
    });

    return toEditionEntity(edition);
  }
}
