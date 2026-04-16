import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GetEditionCouranteUseCase } from '../../application/edition/get-edition-courante.usecase';
import {
  CreateEditionUseCase,
  CreateEditionDto,
} from '../../application/edition/create-edition.usecase';
import {
  UpdateEditionUseCase,
  UpdateEditionDto,
} from '../../application/edition/update-edition.usecase';
import { FirebaseAuthGuard } from '../../../auth/firebase-auth.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';

@Controller('inscription')
export class EditionController {
  constructor(
    private readonly getEditionCourante: GetEditionCouranteUseCase,
    private readonly createEdition: CreateEditionUseCase,
    private readonly updateEdition: UpdateEditionUseCase,
  ) {}

  @Get('edition/courante')
  async courante() {
    return this.getEditionCourante.execute();
  }

  @Post('editions')
  @UseGuards(FirebaseAuthGuard)
  @Roles('ORGANISATEUR')
  async create(@Body() dto: CreateEditionDto) {
    return this.createEdition.execute(dto);
  }

  @Patch('editions/:id')
  @UseGuards(FirebaseAuthGuard)
  @Roles('ORGANISATEUR')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEditionDto,
  ) {
    return this.updateEdition.execute(id, dto);
  }
}
