import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEquipeReferentielDto } from './create-equipe-referentiel.dto';

async function erreurs(plain: Record<string, unknown>) {
  const errors = await validate(plainToInstance(CreateEquipeReferentielDto, plain));
  return errors.map((e) => e.property).sort();
}

// docs/specs/-prise-en-compte-du-nom-court-pour-les-logos-contexte-actuel.md — CA2, CA5, CA6
describe('CreateEquipeReferentielDto', () => {
  it('accepte un nom court seul (nomComplet facultatif)', async () => {
    expect(await erreurs({ nom: 'Rennes' })).toEqual([]);
  });

  it('accepte un nom court et un nom complet', async () => {
    expect(
      await erreurs({ nom: 'Courbevoie', nomComplet: 'Les Coqs de Courbevoie' }),
    ).toEqual([]);
  });

  it('accepte nomComplet à null', async () => {
    expect(await erreurs({ nom: 'Rennes', nomComplet: null })).toEqual([]);
  });

  it('accepte un nom complet de 150 caractères', async () => {
    expect(await erreurs({ nom: 'Rennes', nomComplet: 'a'.repeat(150) })).toEqual([]);
  });

  it('refuse un nom complet de plus de 150 caractères', async () => {
    expect(await erreurs({ nom: 'Rennes', nomComplet: 'a'.repeat(151) })).toEqual([
      'nomComplet',
    ]);
  });

  it("refuse un nom complet qui n'est pas une chaîne", async () => {
    expect(await erreurs({ nom: 'Rennes', nomComplet: 42 })).toEqual(['nomComplet']);
  });

  it('exige toujours le nom court', async () => {
    expect(await erreurs({ nomComplet: 'Les Coqs de Courbevoie' })).toEqual(['nom']);
    expect(await erreurs({ nom: '', nomComplet: 'Les Coqs de Courbevoie' })).toEqual([
      'nom',
    ]);
  });
});
