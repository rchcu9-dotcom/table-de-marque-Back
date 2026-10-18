import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { EquipeReferentiel } from '../../domain/entities/equipe-referentiel.entity';
import {
  MESSAGE_NOM_OBLIGATOIRE,
  MESSAGE_NOM_SANS_EMOJI,
  contientEmoji,
  normaliserEspaces,
  normaliserNomComplet,
} from '../../domain/equipe-referentiel-noms';
import { toEquipeReferentielEntity } from '../../infrastructure/persistence/equipe-referentiel.mapper';
import { CreateEquipeReferentielDto } from './dto/create-equipe-referentiel.dto';

export { CreateEquipeReferentielDto };

@Injectable()
export class CreateEquipeReferentielUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(dto: CreateEquipeReferentielDto): Promise<EquipeReferentiel> {
    // Contrôles d'écriture, ici plutôt que dans le DTO pour valoir quel que
    // soit l'appelant — et hors du try/catch ci-dessous, réservé au P2002.
    const nom = normaliserEspaces(dto.nom);
    if (!nom) {
      throw new BadRequestException(MESSAGE_NOM_OBLIGATOIRE);
    }
    if (contientEmoji(nom) || contientEmoji(dto.nomComplet ?? '')) {
      throw new BadRequestException(MESSAGE_NOM_SANS_EMOJI);
    }

    try {
      const equipe = await this.prisma.inscEquipeReferentiel.create({
        data: {
          nom,
          nomComplet: normaliserNomComplet(nom, dto.nomComplet),
          logoUrl: dto.logoUrl ?? null,
          active: true, // était `false` — la validation préalable obligatoire est retirée
        },
      });
      return toEquipeReferentielEntity(equipe);
    } catch (error) {
      // Seule la violation de l'index unique sur `nom` est traduite : toute
      // autre erreur (panne de base…) doit remonter telle quelle.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Cette équipe existe déjà');
      }
      throw error;
    }
  }
}
