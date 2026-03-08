import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { SoumettreCanditatureDto } from './dto/soumettre-candidature.dto';
import { InscriptionStatut } from '@prisma/client';

export interface CandidatureResult {
  id: number;
  equipeNom: string;
  statut: string;
  createdAt: Date;
}

@Injectable()
export class SoumettreCanditatureUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(
    firebaseUid: string,
    dto: SoumettreCanditatureDto,
  ): Promise<CandidatureResult> {
    // Récupérer l'utilisateur interne
    const utilisateur = await this.prisma.inscUtilisateur.findUnique({
      where: { firebaseUid },
    });
    if (!utilisateur) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Récupérer l'édition courante en INSCRIPTIONS_OUVERTES
    const edition = await this.prisma.inscEdition.findFirst({
      where: { etape: 'INSCRIPTIONS_OUVERTES' },
      orderBy: { createdAt: 'desc' },
    });
    if (!edition) {
      throw new BadRequestException(
        "Aucune édition ouverte aux inscriptions pour le moment",
      );
    }

    // Vérifier que l'utilisateur n'a pas déjà une candidature pour cette édition
    const existingUser = await this.prisma.inscInscription.findFirst({
      where: { editionId: edition.id, utilisateurId: utilisateur.id },
    });
    if (existingUser) {
      throw new ConflictException(
        'Vous avez déjà soumis une candidature pour cette édition',
      );
    }

    // Récupérer l'équipe du référentiel
    const equipe = await this.prisma.inscEquipeReferentiel.findUnique({
      where: { id: dto.equipeRefId },
    });
    if (!equipe) {
      throw new NotFoundException('Équipe référentiel non trouvée');
    }
    if (!equipe.active) {
      throw new BadRequestException("Cette équipe n'est pas active");
    }

    // Vérifier que l'équipe n'a pas déjà une candidature active pour cette édition
    const existingEquipe = await this.prisma.inscInscription.findUnique({
      where: {
        editionId_equipeRefId: {
          editionId: edition.id,
          equipeRefId: dto.equipeRefId,
        },
      },
    });
    if (existingEquipe) {
      if (existingEquipe.statut === InscriptionStatut.DOSSIER_COMPLET) {
        throw new ConflictException('Cette équipe est déjà inscrite');
      }
      throw new ConflictException(
        "Cette équipe est déjà en cours d'inscription",
      );
    }

    // Créer la candidature
    const inscription = await this.prisma.inscInscription.create({
      data: {
        editionId: edition.id,
        utilisateurId: utilisateur.id,
        equipeRefId: dto.equipeRefId,
        equipeNom: equipe.nom,
        statut: InscriptionStatut.CANDIDATE,
      },
    });

    return {
      id: inscription.id,
      equipeNom: inscription.equipeNom,
      statut: inscription.statut,
      createdAt: inscription.createdAt,
    };
  }
}
