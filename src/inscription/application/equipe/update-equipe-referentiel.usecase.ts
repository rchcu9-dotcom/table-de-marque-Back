import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { EquipeReferentiel } from '../../domain/entities/equipe-referentiel.entity';
import {
  MESSAGE_NOM_COURT_VERROUILLE,
  MESSAGE_NOM_OBLIGATOIRE,
  MESSAGE_NOM_SANS_EMOJI,
  contientEmoji,
  estRenommage,
  normaliserEspaces,
  normaliserNomComplet,
} from '../../domain/equipe-referentiel-noms';
import { toEquipeReferentielEntity } from '../../infrastructure/persistence/equipe-referentiel.mapper';
import { UpdateEquipeReferentielDto } from './dto/update-equipe-referentiel.dto';

export { UpdateEquipeReferentielDto };

/**
 * Modification des noms d'une équipe du référentiel par l'organisateur
 * (docs/specs/recommandations-finales-contexte-la-mise-en-place-de-la-colo.md).
 * Le nom complet est toujours modifiable ; le nom court ne l'est plus dès
 * qu'une inscription référence l'équipe, toutes éditions et tous statuts
 * confondus : il est recopié dans `insc_inscriptions.equipe_nom` et sert de
 * clé de correspondance avec `ta_equipes.EQUIPE`.
 */
@Injectable()
export class UpdateEquipeReferentielUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(
    id: number,
    dto: UpdateEquipeReferentielDto,
  ): Promise<EquipeReferentiel> {
    const existant = await this.prisma.inscEquipeReferentiel.findUnique({
      where: { id },
      include: { _count: { select: { inscriptions: true } } },
    });
    if (!existant) {
      throw new NotFoundException(`Équipe référentiel ${id} introuvable`);
    }
    const nbCandidatures = existant._count.inscriptions;

    // Un champ absent du corps n'est pas modifié ; `nomComplet: null` l'efface.
    const nom =
      dto.nom === undefined ? existant.nom : normaliserEspaces(dto.nom);
    if (!nom) {
      throw new BadRequestException(MESSAGE_NOM_OBLIGATOIRE);
    }
    if (contientEmoji(dto.nom ?? '') || contientEmoji(dto.nomComplet ?? '')) {
      throw new BadRequestException(MESSAGE_NOM_SANS_EMOJI);
    }

    const renommage = estRenommage(existant.nom, nom);
    // Toujours repassé par la règle : un renommage peut rendre le nom complet
    // existant égal au nouveau nom court.
    const nomComplet = normaliserNomComplet(
      nom,
      dto.nomComplet === undefined ? existant.nomComplet : dto.nomComplet,
    );

    if (!renommage && nomComplet === existant.nomComplet) {
      return toEquipeReferentielEntity(existant, false, nbCandidatures);
    }

    if (!renommage) {
      // `nom` n'est pas réécrit : une équipe verrouillée garde son nom complet
      // modifiable.
      const equipe = await this.prisma.inscEquipeReferentiel.update({
        where: { id },
        data: { nomComplet },
      });
      return toEquipeReferentielEntity(equipe, false, nbCandidatures);
    }

    if (nbCandidatures > 0) {
      throw new ConflictException(MESSAGE_NOM_COURT_VERROUILLE);
    }

    let modifiees: number;
    try {
      // Contrôle du verrou et écriture dans la même instruction : couvre la
      // candidature soumise depuis la lecture ci-dessus.
      const { count } = await this.prisma.inscEquipeReferentiel.updateMany({
        where: { id, inscriptions: { none: {} } },
        data: { nom, nomComplet },
      });
      modifiees = count;
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
    if (modifiees === 0) {
      throw new ConflictException(MESSAGE_NOM_COURT_VERROUILLE);
    }

    const equipe = await this.prisma.inscEquipeReferentiel.findUnique({
      where: { id },
    });
    if (!equipe) {
      throw new NotFoundException(`Équipe référentiel ${id} introuvable`);
    }
    return toEquipeReferentielEntity(equipe, false, 0);
  }
}
