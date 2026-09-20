import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateEditionDto } from './update-edition.dto';
import { CreateEditionDto } from './create-edition.dto';

// Même configuration que le ValidationPipe global de main.ts.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const transformer = (metatype: unknown) => ({
  type: 'body' as const,
  metatype: metatype as never,
});

describe('UpdateEditionDto (ValidationPipe global)', () => {
  it.each([
    'CREEE',
    'CREATION_NOUVEAU_TOURNOI',
    'INSCRIPTIONS_OUVERTES',
    'CLOTUREE',
    'TOURNOI_DEMARRE',
    'N_IMPORTE_QUOI',
  ])("rejette (400) un PATCH contenant etape = %s", async (etape) => {
    await expect(
      pipe.transform({ nom: 'X', etape }, transformer(UpdateEditionDto)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejette (400) un PATCH contenant dateFinFin (champ retiré)', async () => {
    await expect(
      pipe.transform(
        { dateFinFin: '2026-05-25T23:59:59' },
        transformer(UpdateEditionDto),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepte un PATCH sans etape ni dateFinFin', async () => {
    const result = await pipe.transform(
      { nom: 'Renommée', dateFinDebut: '2026-05-24T23:59:59' },
      transformer(UpdateEditionDto),
    );
    expect(result).toMatchObject({ nom: 'Renommée' });
  });
});

describe('CreateEditionDto (ValidationPipe global)', () => {
  const base = { nom: 'RCHC', categorie: 'U11', annee: 2027 };

  it("conserve etape (état initial du cycle annuel, pas une transition)", async () => {
    const result = await pipe.transform(
      { ...base, etape: 'CREATION_NOUVEAU_TOURNOI' },
      transformer(CreateEditionDto),
    );
    expect(result).toMatchObject({ etape: 'CREATION_NOUVEAU_TOURNOI' });
  });

  it('rejette (400) dateFinFin (champ retiré)', async () => {
    await expect(
      pipe.transform(
        { ...base, dateFinFin: '2027-01-01T00:00:00Z' },
        transformer(CreateEditionDto),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
