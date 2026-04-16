import { Controller, Get } from '@nestjs/common';
import { GetAllPartenairesUseCase } from '@/application/partenaire/use-cases/get-all-partenaires.usecase';

@Controller('partenaires')
export class PartenaireController {
  constructor(private readonly getAllPartenaires: GetAllPartenairesUseCase) {}

  @Get()
  findAll() {
    return this.getAllPartenaires.execute();
  }
}
