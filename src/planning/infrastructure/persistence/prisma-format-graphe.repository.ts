import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlanningPrismaService } from './planning-prisma.service';
import {
  FormatGrapheRepository,
  FormatGraphePropose,
} from '../../domain/repositories/format-graphe.repository';
import { FormatGraphe } from '../../domain/entities/format/format-graphe.entity';
import { FormatGroupe } from '../../domain/entities/format/format-groupe.entity';
import { FormatLien } from '../../domain/entities/format/format-lien.entity';
import { FormatMeta } from '../../domain/entities/format/format-meta.entity';
import { FormatPhase } from '../../domain/entities/format/format-phase.entity';
import { FormatPlace } from '../../domain/entities/format/format-place.entity';
import { FormatPhaseFinale } from '../../domain/enums/format-phase-finale.enum';
import { FormatGroupeFormule } from '../../domain/enums/format-groupe-formule.enum';

type PrismaFormatPhase = {
  id: number;
  editionId: number;
  nom: string;
  ordre: number;
  jours: { editionJourId: number }[];
  groupes: PrismaFormatGroupe[];
};

type PrismaFormatGroupe = {
  id: number;
  phaseId: number;
  nom: string;
  ordre: number;
  formule: string;
  places: PrismaFormatPlace[];
  liensSortants: PrismaFormatLien[];
};

type PrismaFormatPlace = {
  id: number;
  groupeId: number;
  position: number;
  origine: string;
  aliasLabel: string | null;
  lienEntrant: { id: number } | null;
};

type PrismaFormatLien = {
  id: number;
  groupeSourceId: number;
  rangSource: number;
  etat: string;
  groupeCibleId: number | null;
  placeCibleId: number | null;
};

@Injectable()
export class PrismaFormatGrapheRepository extends FormatGrapheRepository {
  constructor(private readonly prisma: PlanningPrismaService) {
    super();
  }

  // ─── Lecture du graphe complet ───────────────────────────────────────────

  async getGraphe(editionId: number): Promise<FormatGraphe> {
    const phases = await this.prisma.formatPhase.findMany({
      where: { editionId },
      orderBy: { ordre: 'asc' },
      include: {
        jours: true,
        groupes: {
          orderBy: { ordre: 'asc' },
          include: {
            places: {
              orderBy: { position: 'asc' },
              include: { lienEntrant: true },
            },
            liensSortants: { orderBy: { rangSource: 'asc' } },
          },
        },
      },
    });

    const meta = await this.prisma.formatMeta.findUnique({
      where: { editionId },
    });

    return this.assemblageGraphe(
      editionId,
      phases as unknown as PrismaFormatPhase[],
      meta,
    );
  }

  // ─── Phases ──────────────────────────────────────────────────────────────

  async createPhase(
    editionId: number,
    nom: string,
    ordre: number,
  ): Promise<FormatPhase> {
    const phase = await this.prisma.formatPhase.create({
      data: { editionId, nom, ordre },
      include: { jours: true },
    });
    return new FormatPhase(
      phase.id,
      phase.editionId,
      phase.nom,
      phase.ordre,
      [],
    );
  }

  async updatePhase(id: number, nom: string): Promise<FormatPhase> {
    const existing = await this.prisma.formatPhase.findUnique({
      where: { id },
      include: { jours: true },
    });
    if (!existing) throw new NotFoundException(`Phase ${id} introuvable`);
    const phase = await this.prisma.formatPhase.update({
      where: { id },
      data: { nom },
      include: { jours: true },
    });
    return new FormatPhase(
      phase.id,
      phase.editionId,
      phase.nom,
      phase.ordre,
      phase.jours.map((j: { editionJourId: number }) => j.editionJourId),
    );
  }

  async deletePhase(id: number): Promise<void> {
    // Supprimer en cascade : groupes → places → liens, puis la phase elle-même
    const groupes = await this.prisma.formatGroupe.findMany({
      where: { phaseId: id },
      include: {
        places: { include: { lienEntrant: true } },
        liensSortants: true,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const groupe of groupes) {
        await this.supprimerGroupeInTx(tx, groupe);
      }
      await tx.formatPhaseJour.deleteMany({ where: { phaseId: id } });
      await tx.formatPhase.delete({ where: { id } });
    });
  }

  async reordonnerPhases(editionId: number, ordreIds: number[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < ordreIds.length; i++) {
        await tx.formatPhase.update({
          where: { id: ordreIds[i] },
          data: { ordre: i + 1 },
        });
      }
    });
  }

  // ─── Groupes ─────────────────────────────────────────────────────────────

  async createGroupe(phaseId: number, nom: string): Promise<FormatGroupe> {
    const existing = await this.prisma.formatGroupe.findMany({
      where: { phaseId },
      orderBy: { ordre: 'desc' },
    });
    const ordre = (existing[0]?.ordre ?? 0) + 1;
    const groupe = await this.prisma.formatGroupe.create({
      data: { phaseId, nom, ordre },
      include: {
        places: {
          include: { lienEntrant: true },
          orderBy: { position: 'asc' },
        },
        liensSortants: { orderBy: { rangSource: 'asc' } },
      },
    });
    return this.toGroupeEntity(groupe as unknown as PrismaFormatGroupe);
  }

  async updateGroupe(
    id: number,
    data: { nom?: string; formule?: FormatGroupeFormule },
  ): Promise<FormatGroupe> {
    const groupe = await this.prisma.formatGroupe.update({
      where: { id },
      data: { nom: data.nom, formule: data.formule },
      include: {
        places: {
          include: { lienEntrant: true },
          orderBy: { position: 'asc' },
        },
        liensSortants: { orderBy: { rangSource: 'asc' } },
      },
    });
    return this.toGroupeEntity(groupe as unknown as PrismaFormatGroupe);
  }

  async deleteGroupe(id: number): Promise<void> {
    const groupe = await this.prisma.formatGroupe.findUnique({
      where: { id },
      include: {
        places: { include: { lienEntrant: true } },
        liensSortants: true,
      },
    });
    if (!groupe) throw new NotFoundException(`Groupe ${id} introuvable`);

    await this.prisma.$transaction(async (tx) => {
      await this.supprimerGroupeInTx(
        tx,
        groupe as unknown as PrismaFormatGroupe,
      );
    });
  }

  // ─── Places ──────────────────────────────────────────────────────────────

  async ajouterPlaceAlias(
    groupeId: number,
    aliasLabel: string,
  ): Promise<FormatPlace> {
    const places = await this.prisma.formatPlace.findMany({
      where: { groupeId },
      orderBy: { position: 'desc' },
    });
    const nouvellePosition = (places[0]?.position ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const place = await tx.formatPlace.create({
        data: {
          groupeId,
          position: nouvellePosition,
          origine: 'ALIAS',
          aliasLabel,
        },
      });

      // Crée ou vérifie le FormatLien NON_DEFINI pour ce rang
      await tx.formatLien.upsert({
        where: {
          groupeSourceId_rangSource: {
            groupeSourceId: groupeId,
            rangSource: nouvellePosition,
          },
        },
        update: {},
        create: {
          groupeSourceId: groupeId,
          rangSource: nouvellePosition,
          etat: 'NON_DEFINI',
        },
      });

      return new FormatPlace(
        place.id,
        place.groupeId,
        place.position,
        'ALIAS',
        place.aliasLabel,
        null,
      );
    });
  }

  async supprimerPlace(id: number): Promise<void> {
    const place = await this.prisma.formatPlace.findUnique({
      where: { id },
      include: { lienEntrant: true },
    });
    if (!place) throw new NotFoundException(`Place ${id} introuvable`);

    await this.prisma.$transaction(async (tx) => {
      // Si la place est LIEE, supprimer le lien entrant également
      if (place.lienEntrant) {
        // Vérifier qu'aucun lien sortant du groupe cible n'est déjà LIE
        const liensLies = await tx.formatLien.findMany({
          where: {
            groupeSourceId: place.groupeId,
            etat: 'LIE',
          },
        });
        if (liensLies.length > 0) {
          throw new ConflictException(
            `Impossible de supprimer la place ${id} : le groupe cible a des liens sortants en état LIE`,
          );
        }
        await tx.formatLien.update({
          where: { id: place.lienEntrant.id },
          data: { etat: 'NON_DEFINI', groupeCibleId: null, placeCibleId: null },
        });
      }

      // Supprimer le lien sortant de rang correspondant si ALIAS et non LIE
      const lienSortant = await tx.formatLien.findUnique({
        where: {
          groupeSourceId_rangSource: {
            groupeSourceId: place.groupeId,
            rangSource: place.position,
          },
        },
      });
      if (lienSortant) {
        if (lienSortant.etat === 'LIE') {
          throw new ConflictException(
            `Impossible de supprimer la place ${id} de rang ${place.position} : le lien sortant est déjà posé (LIE)`,
          );
        }
        await tx.formatLien.delete({ where: { id: lienSortant.id } });
      }

      await tx.formatPlace.delete({ where: { id } });
    });
  }

  // ─── Liens ───────────────────────────────────────────────────────────────

  async definirLien(
    groupeSourceId: number,
    rangSource: number,
    groupeCibleId: number,
  ): Promise<FormatLien> {
    // Validation CA4 : les phases doivent être consécutives
    const groupeSource = await this.prisma.formatGroupe.findUnique({
      where: { id: groupeSourceId },
      include: { phase: true },
    });
    const groupeCible = await this.prisma.formatGroupe.findUnique({
      where: { id: groupeCibleId },
      include: { phase: true },
    });
    if (!groupeSource)
      throw new NotFoundException(
        `Groupe source ${groupeSourceId} introuvable`,
      );
    if (!groupeCible)
      throw new NotFoundException(`Groupe cible ${groupeCibleId} introuvable`);

    if (groupeCible.phase.ordre !== groupeSource.phase.ordre + 1) {
      throw new BadRequestException(
        `Un lien ne peut relier que deux phases consécutives (N → N+1). ` +
          `Phase source ordre=${groupeSource.phase.ordre}, phase cible ordre=${groupeCible.phase.ordre}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const lienExistant = await tx.formatLien.findUnique({
        where: {
          groupeSourceId_rangSource: { groupeSourceId, rangSource },
        },
      });

      // Si un lien LIE existait déjà vers une autre cible, supprimer l'ancienne place cible
      if (lienExistant?.etat === 'LIE' && lienExistant.placeCibleId != null) {
        // Vérifier que l'ancienne place cible n'a pas de lien sortant LIE
        const liensLiesAnciennePlace = await tx.formatLien.findMany({
          where: {
            groupeSourceId: lienExistant.groupeCibleId ?? -1,
            etat: 'LIE',
          },
        });
        if (liensLiesAnciennePlace.length > 0) {
          throw new ConflictException(
            `Impossible de remplacer le lien : l'ancienne place cible du groupe ${lienExistant.groupeCibleId} a déjà des liens sortants LIE`,
          );
        }
        // Supprimer l'ancienne place cible
        await tx.formatPlace.delete({
          where: { id: lienExistant.placeCibleId },
        });
      }

      // Calculer la prochaine position dans le groupe cible
      const placesExistantes = await tx.formatPlace.findMany({
        where: { groupeId: groupeCibleId },
        orderBy: { position: 'desc' },
      });
      const nouvellePosition = (placesExistantes[0]?.position ?? 0) + 1;

      // Créer la place cible
      const placeCible = await tx.formatPlace.create({
        data: {
          groupeId: groupeCibleId,
          position: nouvellePosition,
          origine: 'LIEE',
          aliasLabel: null,
        },
      });

      // Créer/mettre à jour le lien
      const lien = await tx.formatLien.upsert({
        where: {
          groupeSourceId_rangSource: { groupeSourceId, rangSource },
        },
        update: {
          etat: 'LIE',
          groupeCibleId,
          placeCibleId: placeCible.id,
        },
        create: {
          groupeSourceId,
          rangSource,
          etat: 'LIE',
          groupeCibleId,
          placeCibleId: placeCible.id,
        },
      });

      // Créer/synchroniser le FormatLien NON_DEFINI dans le groupe cible pour le rang entrant
      await tx.formatLien.upsert({
        where: {
          groupeSourceId_rangSource: {
            groupeSourceId: groupeCibleId,
            rangSource: nouvellePosition,
          },
        },
        update: {},
        create: {
          groupeSourceId: groupeCibleId,
          rangSource: nouvellePosition,
          etat: 'NON_DEFINI',
        },
      });

      return new FormatLien(
        lien.id,
        lien.groupeSourceId,
        lien.rangSource,
        'LIE',
        lien.groupeCibleId,
        lien.placeCibleId,
      );
    });
  }

  async marquerElimine(
    groupeSourceId: number,
    rangSource: number,
  ): Promise<FormatLien> {
    const lien = await this.prisma.formatLien.upsert({
      where: {
        groupeSourceId_rangSource: { groupeSourceId, rangSource },
      },
      update: { etat: 'ELIMINE', groupeCibleId: null, placeCibleId: null },
      create: {
        groupeSourceId,
        rangSource,
        etat: 'ELIMINE',
      },
    });
    return new FormatLien(
      lien.id,
      lien.groupeSourceId,
      lien.rangSource,
      'ELIMINE',
      null,
      null,
    );
  }

  async reinitialiserLien(
    groupeSourceId: number,
    rangSource: number,
  ): Promise<FormatLien> {
    return this.prisma.$transaction(async (tx) => {
      const lienExistant = await tx.formatLien.findUnique({
        where: {
          groupeSourceId_rangSource: { groupeSourceId, rangSource },
        },
      });
      if (!lienExistant) {
        throw new NotFoundException(
          `Lien groupeSourceId=${groupeSourceId} rangSource=${rangSource} introuvable`,
        );
      }

      // Si LIE et qu'il y a une place cible, la supprimer si possible
      if (lienExistant.etat === 'LIE' && lienExistant.placeCibleId != null) {
        const liensLies = await tx.formatLien.findMany({
          where: {
            groupeSourceId: lienExistant.groupeCibleId ?? -1,
            etat: 'LIE',
          },
        });
        if (liensLies.length > 0) {
          throw new ConflictException(
            `Impossible de réinitialiser : le groupe cible ${lienExistant.groupeCibleId} a déjà des liens sortants LIE`,
          );
        }
        await tx.formatPlace.delete({
          where: { id: lienExistant.placeCibleId },
        });
      }

      const lien = await tx.formatLien.update({
        where: { id: lienExistant.id },
        data: { etat: 'NON_DEFINI', groupeCibleId: null, placeCibleId: null },
      });

      return new FormatLien(
        lien.id,
        lien.groupeSourceId,
        lien.rangSource,
        'NON_DEFINI',
        null,
        null,
      );
    });
  }

  // ─── Phase↔Jour ──────────────────────────────────────────────────────────

  async associerPhaseJour(
    phaseId: number,
    editionJourId: number,
  ): Promise<void> {
    await this.prisma.formatPhaseJour.upsert({
      where: { phaseId_editionJourId: { phaseId, editionJourId } },
      update: {},
      create: { phaseId, editionJourId },
    });
  }

  async dissocierPhaseJour(
    phaseId: number,
    editionJourId: number,
  ): Promise<void> {
    await this.prisma.formatPhaseJour.deleteMany({
      where: { phaseId, editionJourId },
    });
  }

  // ─── Preset (remplacement complet) ───────────────────────────────────────

  async remplacerGrapheComplet(
    editionId: number,
    graphePropose: FormatGraphePropose,
  ): Promise<FormatGraphe> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Supprimer le graphe existant en cascade
      const phasesExistantes = await tx.formatPhase.findMany({
        where: { editionId },
        include: {
          groupes: {
            include: { places: true, liensSortants: true },
          },
          jours: true,
        },
      });

      for (const phase of phasesExistantes) {
        for (const groupe of phase.groupes) {
          // Supprimer les liens sortants
          await tx.formatLien.deleteMany({
            where: { groupeSourceId: groupe.id },
          });
          // Supprimer les places
          await tx.formatPlace.deleteMany({ where: { groupeId: groupe.id } });
        }
        // Supprimer les groupes
        await tx.formatGroupe.deleteMany({ where: { phaseId: phase.id } });
        // Supprimer les associations jour
        await tx.formatPhaseJour.deleteMany({ where: { phaseId: phase.id } });
      }
      // Supprimer les phases
      await tx.formatPhase.deleteMany({ where: { editionId } });

      // 2. Créer les nouvelles phases et groupes
      const phaseOrdreToId = new Map<number, number>();
      const groupeKeyToId = new Map<string, number>();

      // Groupes ciblés par au moins un lien LIE : leurs places viendront
      // exclusivement de la résolution des liens (étape 3, origine LIEE) —
      // ne jamais les pré-remplir d'alias génériques ici, sous peine de
      // doubler l'effectif réel du groupe (une Place ALIAS "Place N" fictive
      // en plus de la Place LIEE légitime), en contradiction avec le modèle
      // (§1 : l'origine ALIAS est réservée à la Phase 1, ou à toute Phase non
      // alimentée par une Phase précédente).
      const groupesCibles = new Set<string>();
      for (const lienDef of graphePropose.liens) {
        if (
          lienDef.etat === 'LIE' &&
          lienDef.phaseOrdreCible != null &&
          lienDef.groupeOrdreCible != null
        ) {
          groupesCibles.add(
            `${lienDef.phaseOrdreCible}-${lienDef.groupeOrdreCible}`,
          );
        }
      }

      for (const phaseDef of graphePropose.phases) {
        const phase = await tx.formatPhase.create({
          data: { editionId, nom: phaseDef.nom, ordre: phaseDef.ordre },
        });
        phaseOrdreToId.set(phaseDef.ordre, phase.id);

        for (const groupeDef of phaseDef.groupes) {
          const groupe = await tx.formatGroupe.create({
            data: {
              phaseId: phase.id,
              nom: groupeDef.nom,
              ordre: groupeDef.ordre,
            },
          });
          const key = `${phaseDef.ordre}-${groupeDef.ordre}`;
          groupeKeyToId.set(key, groupe.id);

          if (!groupesCibles.has(key)) {
            // Créer les places ALIAS (nbPlaces alias "Place 1", "Place 2", ...)
            for (let pos = 1; pos <= groupeDef.nbPlaces; pos++) {
              await tx.formatPlace.create({
                data: {
                  groupeId: groupe.id,
                  position: pos,
                  origine: 'ALIAS',
                  aliasLabel: `Place ${pos}`,
                },
              });
            }
          }
          // Créer les liens NON_DEFINI initiaux (un par rang = 1..nbPlaces),
          // dans tous les cas : chaque Groupe a besoin de ses propres rangs
          // sortants, qu'il soit lui-même alimenté par alias ou par liens.
          for (let rang = 1; rang <= groupeDef.nbPlaces; rang++) {
            await tx.formatLien.create({
              data: {
                groupeSourceId: groupe.id,
                rangSource: rang,
                etat: 'NON_DEFINI',
              },
            });
          }
        }
      }

      // 3. Appliquer les liens proposés
      for (const lienDef of graphePropose.liens) {
        const keySource = `${lienDef.phaseOrdreSource}-${lienDef.groupeOrdreSource}`;
        const groupeSourceId = groupeKeyToId.get(keySource);
        if (!groupeSourceId) continue;

        if (lienDef.etat === 'ELIMINE') {
          await tx.formatLien.update({
            where: {
              groupeSourceId_rangSource: {
                groupeSourceId,
                rangSource: lienDef.rangSource,
              },
            },
            data: { etat: 'ELIMINE' },
          });
        } else if (
          lienDef.etat === 'LIE' &&
          lienDef.phaseOrdreCible != null &&
          lienDef.groupeOrdreCible != null
        ) {
          const keyCible = `${lienDef.phaseOrdreCible}-${lienDef.groupeOrdreCible}`;
          const groupeCibleId = groupeKeyToId.get(keyCible);
          if (!groupeCibleId) continue;

          // Calculer la prochaine position dans le groupe cible
          const placesExistantes = await tx.formatPlace.findMany({
            where: { groupeId: groupeCibleId },
            orderBy: { position: 'desc' },
          });
          const nouvPos = (placesExistantes[0]?.position ?? 0) + 1;

          // Créer la place LIEE dans le groupe cible
          const placeCible = await tx.formatPlace.create({
            data: {
              groupeId: groupeCibleId,
              position: nouvPos,
              origine: 'LIEE',
              aliasLabel: null,
            },
          });

          // Mettre à jour le lien source
          await tx.formatLien.update({
            where: {
              groupeSourceId_rangSource: {
                groupeSourceId,
                rangSource: lienDef.rangSource,
              },
            },
            data: {
              etat: 'LIE',
              groupeCibleId,
              placeCibleId: placeCible.id,
            },
          });

          // Créer/vérifier le lien NON_DEFINI dans le groupe cible pour ce rang entrant
          await tx.formatLien.upsert({
            where: {
              groupeSourceId_rangSource: {
                groupeSourceId: groupeCibleId,
                rangSource: nouvPos,
              },
            },
            update: {},
            create: {
              groupeSourceId: groupeCibleId,
              rangSource: nouvPos,
              etat: 'NON_DEFINI',
            },
          });
        }
      }

      // 4. Mettre à jour FormatMeta
      const preset = graphePropose.phases.length > 0 ? null : null;
      void preset;
      await tx.formatMeta.upsert({
        where: { editionId },
        update: {
          modifieManuellement: false,
          updatedAt: new Date(),
        },
        create: {
          editionId,
          modifieManuellement: false,
          updatedAt: new Date(),
        },
      });

      // 5. Relire et retourner le graphe complet
      const phases = await tx.formatPhase.findMany({
        where: { editionId },
        orderBy: { ordre: 'asc' },
        include: {
          jours: true,
          groupes: {
            orderBy: { ordre: 'asc' },
            include: {
              places: {
                orderBy: { position: 'asc' },
                include: { lienEntrant: true },
              },
              liensSortants: { orderBy: { rangSource: 'asc' } },
            },
          },
        },
      });

      const metaRecord = await tx.formatMeta.findUnique({
        where: { editionId },
      });
      return this.assemblageGraphe(
        editionId,
        phases as unknown as PrismaFormatPhase[],
        metaRecord,
      );
    });
  }

  // ─── Meta ─────────────────────────────────────────────────────────────────

  async getMeta(editionId: number): Promise<FormatMeta | null> {
    const meta = await this.prisma.formatMeta.findUnique({
      where: { editionId },
    });
    if (!meta) return null;
    return new FormatMeta(
      meta.editionId,
      (meta.genereDepuisPreset as FormatPhaseFinale | null) ?? null,
      meta.modifieManuellement,
      meta.updatedAt,
    );
  }

  async marquerModifieManuellement(editionId: number): Promise<void> {
    await this.prisma.formatMeta.upsert({
      where: { editionId },
      update: { modifieManuellement: true, updatedAt: new Date() },
      create: {
        editionId,
        modifieManuellement: true,
        updatedAt: new Date(),
      },
    });
  }

  // ─── Helpers privés ───────────────────────────────────────────────────────

  private assemblageGraphe(
    editionId: number,
    phases: PrismaFormatPhase[],
    meta: {
      genereDepuisPreset?: string | null;
      modifieManuellement?: boolean;
      updatedAt?: Date;
    } | null,
  ): FormatGraphe {
    const groupes: FormatGroupe[] = [];
    const liens: FormatLien[] = [];

    for (const phase of phases) {
      for (const groupe of phase.groupes) {
        groupes.push(this.toGroupeEntity(groupe));
        for (const lien of groupe.liensSortants) {
          liens.push(this.toLienEntity(lien));
        }
      }
    }

    return new FormatGraphe(
      editionId,
      phases.map(
        (p) =>
          new FormatPhase(
            p.id,
            p.editionId,
            p.nom,
            p.ordre,
            p.jours.map((j) => j.editionJourId),
          ),
      ),
      groupes,
      liens,
      meta?.modifieManuellement ?? false,
      (meta?.genereDepuisPreset as FormatPhaseFinale | null) ?? null,
    );
  }

  private toGroupeEntity(groupe: PrismaFormatGroupe): FormatGroupe {
    return new FormatGroupe(
      groupe.id,
      groupe.phaseId,
      groupe.nom,
      groupe.ordre,
      groupe.places.map(
        (p) =>
          new FormatPlace(
            p.id,
            p.groupeId,
            p.position,
            p.origine as 'ALIAS' | 'LIEE',
            p.aliasLabel,
            p.lienEntrant?.id ?? null,
          ),
      ),
      groupe.formule as FormatGroupeFormule,
    );
  }

  private toLienEntity(lien: PrismaFormatLien): FormatLien {
    return new FormatLien(
      lien.id,
      lien.groupeSourceId,
      lien.rangSource,
      lien.etat as 'NON_DEFINI' | 'ELIMINE' | 'LIE',
      lien.groupeCibleId,
      lien.placeCibleId,
    );
  }

  private async supprimerGroupeInTx(
    tx: Parameters<Parameters<PlanningPrismaService['$transaction']>[0]>[0],
    groupe: PrismaFormatGroupe,
  ): Promise<void> {
    await tx.formatLien.deleteMany({ where: { groupeSourceId: groupe.id } });
    await tx.formatPlace.deleteMany({ where: { groupeId: groupe.id } });
    await tx.formatGroupe.delete({ where: { id: groupe.id } });
  }
}
