import { Injectable, NotFoundException } from '@nestjs/common';
import {
  TaMatch,
  TaEquipe,
  TaClassement,
  TaJoueur,
  TaConfiguration,
} from '@prisma/client';
import { PrismaService } from '@/infrastructure/persistence/mysql/prisma.service';
import { slugifyTeamName } from '@/infrastructure/persistence/mysql/mysql-utils';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

export interface TaDumpPayload {
  TA_MATCHS: TaMatch[];
  ta_equipes: TaEquipe[];
  ta_classement: TaClassement[];
  ta_joueurs: TaJoueur[];
  ta_configuration: TaConfiguration[];
}

export interface TaDumpResult {
  filename: string;
  payload: TaDumpPayload;
}

/**
 * Dump bloquant des 5 tables legacy TA_* (spec "cycle annuel de l'édition"
 * §4) : lecture pure, aucune écriture, rejouable sans risque. Protège les
 * résultats de la saison sortante avant que la confirmation du planning de
 * la saison suivante n'écrase TA_MATCHS par NUM_MATCH (spec §1/§7,
 * PrismaPlanningMatchWriter.ecrireMatchs()).
 *
 * `:id` ne filtre pas la requête (ces tables n'ont pas d'`editionId`) — il
 * sert uniquement à retrouver nom/année pour nommer le fichier exporté.
 * `ta_cache_snapshots` est volontairement exclu : cache technique SWR
 * régénéré à chaud, sans valeur historique.
 */
@Injectable()
export class ExportTaUseCase {
  constructor(
    private readonly inscriptionPrisma: InscriptionPrismaService,
    private readonly legacyPrisma: PrismaService,
  ) {}

  async execute(editionId: number): Promise<TaDumpResult> {
    const edition = await this.inscriptionPrisma.inscEdition.findUnique({
      where: { id: editionId },
    });
    if (!edition) {
      throw new NotFoundException(`Édition ${editionId} introuvable`);
    }

    const [taMatchs, taEquipes, taClassement, taJoueurs, taConfiguration] =
      await Promise.all([
        this.legacyPrisma.taMatch.findMany(),
        this.legacyPrisma.taEquipe.findMany(),
        this.legacyPrisma.taClassement.findMany(),
        this.legacyPrisma.taJoueur.findMany(),
        this.legacyPrisma.taConfiguration.findMany(),
      ]);

    const slug = slugifyTeamName(edition.nom);
    const filename = `dump-ta-${edition.annee}${slug ? `-${slug}` : ''}.json`;

    return {
      filename,
      payload: {
        TA_MATCHS: taMatchs,
        ta_equipes: taEquipes,
        ta_classement: taClassement,
        ta_joueurs: taJoueurs,
        ta_configuration: taConfiguration,
      },
    };
  }
}
