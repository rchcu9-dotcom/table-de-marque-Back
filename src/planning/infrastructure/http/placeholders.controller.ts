import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '@/auth/decorators/roles.decorator';
import { assertApiWritable } from '@/infrastructure/http/read-only.util';
import { GetPlaceholdersUseCase } from '../../application/use-cases/get-placeholders.usecase';
import { RevaliderPlaceholdersUseCase } from '../../application/use-cases/revalider-placeholders.usecase';
import { ResoudrePlaceholderManuelUseCase } from '../../application/use-cases/resoudre-placeholder-manuel.usecase';
import { ResoudrePlaceholderDto } from '../../application/dto/resoudre-placeholder.dto';

@Controller('planning')
@Roles('ORGANISATEUR')
export class PlaceholdersController {
  constructor(
    private readonly getPlaceholders: GetPlaceholdersUseCase,
    private readonly revaliderPlaceholders: RevaliderPlaceholdersUseCase,
    private readonly resoudrePlaceholderManuel: ResoudrePlaceholderManuelUseCase,
  ) {}

  @Get(':editionId/placeholders')
  liste(@Param('editionId', ParseIntPipe) editionId: number) {
    return this.getPlaceholders.execute(editionId);
  }

  @Post(':editionId/placeholders/revalidate')
  revalider(@Param('editionId', ParseIntPipe) editionId: number) {
    assertApiWritable();
    return this.revaliderPlaceholders.execute(editionId);
  }

  @Patch(':editionId/placeholders/:id/resoudre')
  resoudre(
    @Param('editionId', ParseIntPipe) editionId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResoudrePlaceholderDto,
  ) {
    assertApiWritable();
    return this.resoudrePlaceholderManuel.execute(editionId, id, dto.equipeId);
  }
}
