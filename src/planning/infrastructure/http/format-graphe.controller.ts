import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { Roles } from '@/auth/decorators/roles.decorator';
import { assertApiWritable } from '@/infrastructure/http/read-only.util';
import { GetFormatGrapheUseCase } from '../../application/use-cases/format-graphe/get-format-graphe.usecase';
import { CreerPhaseUseCase } from '../../application/use-cases/format-graphe/creer-phase.usecase';
import { ModifierPhaseUseCase } from '../../application/use-cases/format-graphe/modifier-phase.usecase';
import { SupprimerPhaseUseCase } from '../../application/use-cases/format-graphe/supprimer-phase.usecase';
import { ReordonnerPhasesUseCase } from '../../application/use-cases/format-graphe/reordonner-phases.usecase';
import { CreerGroupeUseCase } from '../../application/use-cases/format-graphe/creer-groupe.usecase';
import { ModifierGroupeUseCase } from '../../application/use-cases/format-graphe/modifier-groupe.usecase';
import { SupprimerGroupeUseCase } from '../../application/use-cases/format-graphe/supprimer-groupe.usecase';
import { AjouterPlaceAliasUseCase } from '../../application/use-cases/format-graphe/ajouter-place-alias.usecase';
import { SupprimerPlaceUseCase } from '../../application/use-cases/format-graphe/supprimer-place.usecase';
import { DefinirLienUseCase } from '../../application/use-cases/format-graphe/definir-lien.usecase';
import { MarquerEliminieUseCase } from '../../application/use-cases/format-graphe/marquer-elimine.usecase';
import { ReinitialiserLienUseCase } from '../../application/use-cases/format-graphe/reinitialiser-lien.usecase';
import { AssocierPhaseJourUseCase } from '../../application/use-cases/format-graphe/associer-phase-jour.usecase';
import { DissocierPhaseJourUseCase } from '../../application/use-cases/format-graphe/dissocier-phase-jour.usecase';
import { GenererPresetUseCase } from '../../application/use-cases/format-graphe/generer-preset.usecase';
import { CreerPhaseDto } from '../../application/dto/format-graphe/creer-phase.dto';
import { ModifierPhaseDto } from '../../application/dto/format-graphe/modifier-phase.dto';
import { ReordonnerPhasesDto } from '../../application/dto/format-graphe/reordonner-phases.dto';
import { CreerGroupeDto } from '../../application/dto/format-graphe/creer-groupe.dto';
import { ModifierGroupeDto } from '../../application/dto/format-graphe/modifier-groupe.dto';
import { AjouterPlaceAliasDto } from '../../application/dto/format-graphe/ajouter-place-alias.dto';
import { DefinirLienDto } from '../../application/dto/format-graphe/definir-lien.dto';
import { AssocierPhaseJourDto } from '../../application/dto/format-graphe/associer-phase-jour.dto';
import { GenererPresetDto } from '../../application/dto/format-graphe/generer-preset.dto';

@Controller('format-graphe')
@Roles('ORGANISATEUR')
export class FormatGrapheController {
  constructor(
    private readonly getFormatGraphe: GetFormatGrapheUseCase,
    private readonly creerPhase: CreerPhaseUseCase,
    private readonly modifierPhase: ModifierPhaseUseCase,
    private readonly supprimerPhase: SupprimerPhaseUseCase,
    private readonly reordonnerPhases: ReordonnerPhasesUseCase,
    private readonly creerGroupe: CreerGroupeUseCase,
    private readonly modifierGroupe: ModifierGroupeUseCase,
    private readonly supprimerGroupe: SupprimerGroupeUseCase,
    private readonly ajouterPlaceAlias: AjouterPlaceAliasUseCase,
    private readonly supprimerPlace: SupprimerPlaceUseCase,
    private readonly definirLien: DefinirLienUseCase,
    private readonly marquerElimine: MarquerEliminieUseCase,
    private readonly reinitialiserLien: ReinitialiserLienUseCase,
    private readonly associerPhaseJour: AssocierPhaseJourUseCase,
    private readonly dissocierPhaseJour: DissocierPhaseJourUseCase,
    private readonly genererPreset: GenererPresetUseCase,
  ) {}

  // ─── Graphe complet ───────────────────────────────────────────────────────

  @Get(':editionId')
  getGraphe(@Param('editionId', ParseIntPipe) editionId: number) {
    return this.getFormatGraphe.execute(editionId);
  }

  // ─── Phases ───────────────────────────────────────────────────────────────

  @Post(':editionId/phases')
  creerUnePhase(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Body() dto: CreerPhaseDto,
  ) {
    assertApiWritable();
    return this.creerPhase.execute(editionId, dto);
  }

  @Put(':editionId/phases/:phaseId')
  modifierUnePhase(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Body() dto: ModifierPhaseDto,
  ) {
    assertApiWritable();
    return this.modifierPhase.execute(editionId, phaseId, dto);
  }

  @Delete(':editionId/phases/:phaseId')
  supprimerUnePhase(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('phaseId', ParseIntPipe) phaseId: number,
  ) {
    assertApiWritable();
    return this.supprimerPhase.execute(editionId, phaseId);
  }

  @Put(':editionId/phases/ordre')
  reordonnerLesPhases(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Body() dto: ReordonnerPhasesDto,
  ) {
    assertApiWritable();
    return this.reordonnerPhases.execute(editionId, dto);
  }

  // ─── Groupes ──────────────────────────────────────────────────────────────

  @Post(':editionId/phases/:phaseId/groupes')
  creerUnGroupe(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Body() dto: CreerGroupeDto,
  ) {
    assertApiWritable();
    return this.creerGroupe.execute(editionId, phaseId, dto);
  }

  @Put(':editionId/groupes/:groupeId')
  modifierUnGroupe(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('groupeId', ParseIntPipe) groupeId: number,
    @Body() dto: ModifierGroupeDto,
  ) {
    assertApiWritable();
    return this.modifierGroupe.execute(editionId, groupeId, dto);
  }

  @Delete(':editionId/groupes/:groupeId')
  supprimerUnGroupe(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('groupeId', ParseIntPipe) groupeId: number,
  ) {
    assertApiWritable();
    return this.supprimerGroupe.execute(editionId, groupeId);
  }

  // ─── Places ───────────────────────────────────────────────────────────────

  @Post(':editionId/groupes/:groupeId/places')
  ajouterUnePlace(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('groupeId', ParseIntPipe) groupeId: number,
    @Body() dto: AjouterPlaceAliasDto,
  ) {
    assertApiWritable();
    return this.ajouterPlaceAlias.execute(editionId, groupeId, dto);
  }

  @Delete(':editionId/places/:placeId')
  supprimerUnePlace(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('placeId', ParseIntPipe) placeId: number,
  ) {
    assertApiWritable();
    return this.supprimerPlace.execute(editionId, placeId);
  }

  // ─── Liens ────────────────────────────────────────────────────────────────

  @Put(':editionId/groupes/:groupeSourceId/liens/:rangSource/cible')
  definirUnLien(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('groupeSourceId', ParseIntPipe) groupeSourceId: number,
    @Param('rangSource', ParseIntPipe) rangSource: number,
    @Body() dto: DefinirLienDto,
  ) {
    assertApiWritable();
    return this.definirLien.execute(editionId, groupeSourceId, rangSource, dto);
  }

  @Put(':editionId/groupes/:groupeSourceId/liens/:rangSource/elimine')
  marquerRangElimine(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('groupeSourceId', ParseIntPipe) groupeSourceId: number,
    @Param('rangSource', ParseIntPipe) rangSource: number,
  ) {
    assertApiWritable();
    return this.marquerElimine.execute(editionId, groupeSourceId, rangSource);
  }

  @Put(':editionId/groupes/:groupeSourceId/liens/:rangSource/reinitialiser')
  reinitialiserUnLien(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('groupeSourceId', ParseIntPipe) groupeSourceId: number,
    @Param('rangSource', ParseIntPipe) rangSource: number,
  ) {
    assertApiWritable();
    return this.reinitialiserLien.execute(
      editionId,
      groupeSourceId,
      rangSource,
    );
  }

  // ─── Phase ↔ Jour ─────────────────────────────────────────────────────────

  @Post(':editionId/phases/:phaseId/jours')
  associerUnJour(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Body() dto: AssocierPhaseJourDto,
  ) {
    assertApiWritable();
    return this.associerPhaseJour.execute(editionId, phaseId, dto);
  }

  @Delete(':editionId/phases/:phaseId/jours/:editionJourId')
  dissocierUnJour(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('phaseId', ParseIntPipe) phaseId: number,
    @Param('editionJourId', ParseIntPipe) editionJourId: number,
  ) {
    assertApiWritable();
    return this.dissocierPhaseJour.execute(editionId, phaseId, editionJourId);
  }

  // ─── Preset ───────────────────────────────────────────────────────────────

  @Post(':editionId/preset')
  genererUnPreset(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Body() dto: GenererPresetDto,
  ) {
    assertApiWritable();
    return this.genererPreset.execute(editionId, dto);
  }
}
