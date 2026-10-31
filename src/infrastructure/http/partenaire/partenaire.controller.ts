import { Controller, Get } from '@nestjs/common';
import { Public } from '@/auth/decorators/public.decorator';
import { GetAllPartenairesUseCase } from '@/application/partenaire/use-cases/get-all-partenaires.usecase';

@Controller('partenaires')
@Public()
export class PartenaireController {
  constructor(private readonly getAllPartenaires: GetAllPartenairesUseCase) {}

  @Get()
  findAll() {
    return this.getAllPartenaires.execute();
  }
}
