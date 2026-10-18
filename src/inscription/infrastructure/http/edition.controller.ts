import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { GetEditionCouranteUseCase } from '../../application/edition/get-edition-courante.usecase';
import { GetEditionEnPreparationUseCase } from '../../application/edition/get-edition-en-preparation.usecase';
import {
  CreateEditionUseCase,
  CreateEditionDto,
} from '../../application/edition/create-edition.usecase';
import {
  UpdateEditionUseCase,
  UpdateEditionDto,
} from '../../application/edition/update-edition.usecase';
import { DemarrerTournoiUseCase } from '../../application/edition/demarrer-tournoi.usecase';
import { OuvrirInscriptionsUseCase } from '../../application/edition/ouvrir-inscriptions.usecase';
import { CloturerInscriptionsUseCase } from '../../application/edition/cloturer-inscriptions.usecase';
import { RevenirEnPreparationUseCase } from '../../application/edition/revenir-en-preparation.usecase';
import { ExportTaUseCase } from '../../application/edition/export-ta.usecase';
import {
  AjouterAnneeAgeUseCase,
  AjouterAnneeAgeDto,
} from '../../application/edition/ajouter-annee-age.usecase';
import { RetirerAnneeAgeUseCase } from '../../application/edition/retirer-annee-age.usecase';
import { UploadImageRibUseCase } from '../../application/edition/upload-image-rib.usecase';
import { GetImageRibUseCase } from '../../application/edition/get-image-rib.usecase';
import { DeleteImageRibUseCase } from '../../application/edition/delete-image-rib.usecase';
import { IMAGE_RIB_MAX_SIZE_BYTES } from '../../application/edition/image-rib.constants';
import { Roles } from '../../../auth/decorators/roles.decorator';

@Controller('inscription')
export class EditionController {
  constructor(
    private readonly getEditionCourante: GetEditionCouranteUseCase,
    private readonly getEditionEnPreparation: GetEditionEnPreparationUseCase,
    private readonly createEdition: CreateEditionUseCase,
    private readonly updateEdition: UpdateEditionUseCase,
    private readonly demarrerTournoi: DemarrerTournoiUseCase,
    private readonly ouvrirInscriptions: OuvrirInscriptionsUseCase,
    private readonly cloturerInscriptions: CloturerInscriptionsUseCase,
    private readonly revenirEnPreparationUseCase: RevenirEnPreparationUseCase,
    private readonly exportTa: ExportTaUseCase,
    private readonly ajouterAnneeAge: AjouterAnneeAgeUseCase,
    private readonly retirerAnneeAge: RetirerAnneeAgeUseCase,
    private readonly uploadImageRib: UploadImageRibUseCase,
    private readonly getImageRib: GetImageRibUseCase,
    private readonly deleteImageRib: DeleteImageRibUseCase,
  ) {}

  @Get('edition/courante')
  async courante() {
    return this.getEditionCourante.execute();
  }

  @Get('edition/en-preparation')
  @Roles('ORGANISATEUR')
  async enPreparation() {
    return this.getEditionEnPreparation.execute();
  }

  @Post('editions')
  @Roles('ORGANISATEUR')
  async create(@Body() dto: CreateEditionDto) {
    return this.createEdition.execute(dto);
  }

  @Patch('editions/:id')
  @Roles('ORGANISATEUR')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEditionDto,
  ) {
    return this.updateEdition.execute(id, dto);
  }

  @Post('editions/:id/demarrer-tournoi')
  @Roles('ORGANISATEUR')
  async demarrer(@Param('id', ParseIntPipe) id: number) {
    return this.demarrerTournoi.execute(id);
  }

  @Post('editions/:id/ouvrir-inscriptions')
  @Roles('ORGANISATEUR')
  async ouvrir(@Param('id', ParseIntPipe) id: number) {
    return this.ouvrirInscriptions.execute(id);
  }

  @Post('editions/:id/cloturer-inscriptions')
  @Roles('ORGANISATEUR')
  async cloturer(@Param('id', ParseIntPipe) id: number) {
    return this.cloturerInscriptions.execute(id);
  }

  @Post('editions/:id/revenir-en-preparation')
  @Roles('ORGANISATEUR')
  async revenirEnPreparation(@Param('id', ParseIntPipe) id: number) {
    return this.revenirEnPreparationUseCase.execute(id);
  }

  @Post('editions/:id/annees-age')
  @Roles('ORGANISATEUR')
  async ajouterAnnee(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AjouterAnneeAgeDto,
  ) {
    return this.ajouterAnneeAge.execute(id, dto);
  }

  @Delete('editions/:id/annees-age/:annee')
  @Roles('ORGANISATEUR')
  async retirerAnnee(
    @Param('id', ParseIntPipe) id: number,
    @Param('annee', ParseIntPipe) annee: number,
  ) {
    return this.retirerAnneeAge.execute(id, annee);
  }

  @Post('editions/:id/image-rib')
  @Roles('ORGANISATEUR')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMAGE_RIB_MAX_SIZE_BYTES } }),
  )
  async uploadImageRibFile(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.uploadImageRib.execute(id, file);
  }

  // Route publique : servie directement par une balise <img> côté
  // InscriptionPage, qui ne peut pas transmettre d'en-tête Authorization.
  @Get('editions/:id/image-rib')
  async getImageRibFile(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { data, mimeType } = await this.getImageRib.execute(id);
    res.set({
      'Content-Type': mimeType,
      'Cache-Control': 'max-age=3600',
    });
    res.send(data);
  }

  @Delete('editions/:id/image-rib')
  @Roles('ORGANISATEUR')
  async deleteImageRibFile(@Param('id', ParseIntPipe) id: number) {
    return this.deleteImageRib.execute(id);
  }

  @Get('editions/:id/export-ta')
  @Roles('ORGANISATEUR')
  async exportTaTables(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { filename, payload } = await this.exportTa.execute(id);
    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return payload;
  }
}
