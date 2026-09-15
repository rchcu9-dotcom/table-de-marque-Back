import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '@/auth/decorators/roles.decorator';
import { DriveImageProxyService } from './drive-image-proxy.service';
import { assertApiWritable } from '@/infrastructure/http/read-only.util';
import { GetPresentationUseCase } from '@/application/presentation/use-cases/get-presentation.usecase';
import { ListPresentationArticlesUseCase } from '@/application/presentation/use-cases/list-presentation-articles.usecase';
import { CreerPresentationArticleUseCase } from '@/application/presentation/use-cases/creer-presentation-article.usecase';
import { ModifierPresentationArticleUseCase } from '@/application/presentation/use-cases/modifier-presentation-article.usecase';
import { SupprimerPresentationArticleUseCase } from '@/application/presentation/use-cases/supprimer-presentation-article.usecase';
import { ModifierPresentationGroupeUseCase } from '@/application/presentation/use-cases/modifier-presentation-groupe.usecase';
import { DeplacerPresentationGroupeUseCase } from '@/application/presentation/use-cases/deplacer-presentation-groupe.usecase';
import { DeplacerPresentationArticleUseCase } from '@/application/presentation/use-cases/deplacer-presentation-article.usecase';
import { SupprimerPresentationGroupeUseCase } from '@/application/presentation/use-cases/supprimer-presentation-groupe.usecase';
import { UpsertPresentationArticleDto } from '@/application/presentation/dto/upsert-presentation-article.dto';
import { UpdatePresentationGroupeDto } from '@/application/presentation/dto/update-presentation-groupe.dto';
import { DeplacerDirectionDto } from '@/application/presentation/dto/deplacer-direction.dto';
import { PresentationGroupe } from '@/domain/presentation/entities/article-presentation.entity';
import { CacheSnapshotService } from '@/infrastructure/cache/cache.snapshot.service';

@Controller('presentation')
export class PresentationController {
  constructor(
    private readonly getPresentation: GetPresentationUseCase,
    private readonly listArticles: ListPresentationArticlesUseCase,
    private readonly creerArticle: CreerPresentationArticleUseCase,
    private readonly modifierArticle: ModifierPresentationArticleUseCase,
    private readonly supprimerArticle: SupprimerPresentationArticleUseCase,
    private readonly modifierGroupe: ModifierPresentationGroupeUseCase,
    private readonly deplacerGroupe: DeplacerPresentationGroupeUseCase,
    private readonly deplacerArticle: DeplacerPresentationArticleUseCase,
    private readonly supprimerGroupe: SupprimerPresentationGroupeUseCase,
    private readonly cache: CacheSnapshotService,
    private readonly driveImageProxy: DriveImageProxyService,
  ) {}

  @Get()
  async findAll(): Promise<PresentationGroupe[]> {
    return this.cache.readThrough('presentation', () =>
      this.getPresentation.execute(),
    );
  }

  // Relais public (pas d'auth : servi sur la page d'accueil avant connexion) des photos
  // Google Drive de la présentation — le navigateur ne peut pas les charger en direct
  // (cf. commentaire de DriveImageProxyService), ce endpoint fait l'appel côté serveur.
  @Get('image/:fileId')
  async image(
    @Param('fileId') fileId: string,
    @Query('w') w: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const width = Math.min(Math.max(parseInt(w ?? '', 10) || 1600, 100), 2000);
    const result = await this.driveImageProxy.fetch(fileId, width);
    if (!result) {
      res.status(502).end();
      return;
    }
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(result.buffer);
  }

  // Vue admin non mise en cache : l'organisateur édite les lignes brutes (une par
  // article), pas les groupes agrégés servis au public par GET /presentation.
  @Get('articles')
  @Roles('ORGANISATEUR')
  async articles() {
    return this.listArticles.execute();
  }

  @Post('articles')
  @Roles('ORGANISATEUR')
  async creer(@Body() dto: UpsertPresentationArticleDto) {
    assertApiWritable();
    const article = await this.creerArticle.execute(dto);
    await this.refreshCache();
    return article;
  }

  @Put('articles/:id')
  @Roles('ORGANISATEUR')
  async modifier(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertPresentationArticleDto,
  ) {
    assertApiWritable();
    const article = await this.modifierArticle.execute(id, dto);
    await this.refreshCache();
    return article;
  }

  @Delete('articles/:id')
  @Roles('ORGANISATEUR')
  async supprimer(@Param('id', ParseIntPipe) id: number) {
    assertApiWritable();
    await this.supprimerArticle.execute(id);
    await this.refreshCache();
  }

  @Patch('articles/:id/deplacer')
  @Roles('ORGANISATEUR')
  async deplacerUnArticle(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeplacerDirectionDto,
  ) {
    assertApiWritable();
    await this.deplacerArticle.execute(id, dto);
    await this.refreshCache();
  }

  @Patch('groupes/:groupe')
  @Roles('ORGANISATEUR')
  async modifierUnGroupe(
    @Param('groupe') groupe: string,
    @Body() dto: UpdatePresentationGroupeDto,
  ) {
    assertApiWritable();
    await this.modifierGroupe.execute(groupe, dto);
    await this.refreshCache();
  }

  @Patch('groupes/:groupe/deplacer')
  @Roles('ORGANISATEUR')
  async deplacerUnGroupe(
    @Param('groupe') groupe: string,
    @Body() dto: DeplacerDirectionDto,
  ) {
    assertApiWritable();
    await this.deplacerGroupe.execute(groupe, dto);
    await this.refreshCache();
  }

  @Delete('groupes/:groupe')
  @Roles('ORGANISATEUR')
  async supprimerUnGroupe(@Param('groupe') groupe: string) {
    assertApiWritable();
    await this.supprimerGroupe.execute(groupe);
    await this.refreshCache();
  }

  // Les écritures admin sont rares (GUI de paramétrage, pas un flux applicatif) : on
  // recalcule et republie le cache tout de suite plutôt que d'attendre son TTL (60s),
  // pour que la page d'accueil publique reflète la modification sans délai perceptible.
  private async refreshCache(): Promise<void> {
    const fresh = await this.getPresentation.execute();
    this.cache.setEntry('presentation', fresh);
  }
}
