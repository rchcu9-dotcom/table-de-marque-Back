import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateEquipeReferentielDto } from './update-equipe-referentiel.dto';

async function erreurs(plain: Record<string, unknown>) {
  const errors = await validate(plainToInstance(UpdateEquipeReferentielDto, plain));
  return errors.map((e) => e.property).sort();
}

// docs/specs/recommandations-finales-contexte-la-mise-en-place-de-la-colo.md — §6
describe('UpdateEquipeReferentielDto', () => {
  it('accepte un corps vide (aucun champ modifié)', async () => {
    expect(await erreurs({})).toEqual([]);
  });

  it('accepte le nom court seul, le nom complet seul, ou les deux', async () => {
    expect(await erreurs({ nom: 'Rennes' })).toEqual([]);
    expect(await erreurs({ nomComplet: 'Les Cormorans de Rennes' })).toEqual([]);
    expect(
      await erreurs({ nom: 'Rennes', nomComplet: 'Les Cormorans de Rennes' }),
    ).toEqual([]);
  });

  it('accepte nomComplet à null (effacement)', async () => {
    expect(await erreurs({ nomComplet: null })).toEqual([]);
  });

  it('accepte un nom court de 100 caractères et refuse au-delà', async () => {
    expect(await erreurs({ nom: 'a'.repeat(100) })).toEqual([]);
    expect(await erreurs({ nom: 'a'.repeat(101) })).toEqual(['nom']);
  });

  it('accepte un nom complet de 150 caractères et refuse au-delà', async () => {
    expect(await erreurs({ nomComplet: 'a'.repeat(150) })).toEqual([]);
    expect(await erreurs({ nomComplet: 'a'.repeat(151) })).toEqual(['nomComplet']);
  });

  it('refuse des valeurs qui ne sont pas des chaînes', async () => {
    expect(await erreurs({ nom: 42 })).toEqual(['nom']);
    expect(await erreurs({ nomComplet: 42 })).toEqual(['nomComplet']);
  });

  describe('avec la configuration du ValidationPipe global (main.ts)', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const transformer = (valeur: unknown) =>
      pipe.transform(valeur, { type: 'body', metatype: UpdateEquipeReferentielDto });

    it.each(['logoUrl', 'active'])(
      'refuse %s : non modifiable par cette route',
      async (champ) => {
        await expect(
          transformer({ nomComplet: 'Coqs HC', [champ]: 'x' }),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it('renvoie 400 au-delà des longueurs maximales', async () => {
      await expect(transformer({ nom: 'a'.repeat(101) })).rejects.toThrow(
        BadRequestException,
      );
      await expect(transformer({ nomComplet: 'a'.repeat(151) })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
