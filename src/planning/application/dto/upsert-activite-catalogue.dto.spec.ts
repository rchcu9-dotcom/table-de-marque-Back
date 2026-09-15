import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertActiviteCatalogueDto } from './upsert-activite-catalogue.dto';

/**
 * Régression : le ValidationPipe global (main.ts) tourne avec
 * whitelist + forbidNonWhitelisted — un champ non décoré ou une valeur hors
 * contrainte doit être rejeté explicitement, jamais silencieusement ignoré.
 */
describe('UpsertActiviteCatalogueDto', () => {
  it('valide un payload de création tel qu\'envoyé par le front', async () => {
    const raw = { label: 'Repas', dureeParEquipeMin: 40, capaciteParallele: 4 };

    const instance = plainToInstance(UpsertActiviteCatalogueDto, raw);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors).toHaveLength(0);
  });

  it('rejette un label vide', async () => {
    const raw = { label: '', dureeParEquipeMin: 40, capaciteParallele: 4 };

    const instance = plainToInstance(UpsertActiviteCatalogueDto, raw);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors.some((e) => e.property === 'label')).toBe(true);
  });

  it('rejette une dureeParEquipeMin nulle ou négative', async () => {
    const raw = { label: 'Repas', dureeParEquipeMin: 0, capaciteParallele: 4 };

    const instance = plainToInstance(UpsertActiviteCatalogueDto, raw);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors.some((e) => e.property === 'dureeParEquipeMin')).toBe(true);
  });

  it('rejette une capaciteParallele nulle ou négative', async () => {
    const raw = { label: 'Repas', dureeParEquipeMin: 40, capaciteParallele: 0 };

    const instance = plainToInstance(UpsertActiviteCatalogueDto, raw);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors.some((e) => e.property === 'capaciteParallele')).toBe(true);
  });

  it('rejette un champ additionnel non whitelisté', async () => {
    const raw = { label: 'Repas', dureeParEquipeMin: 40, capaciteParallele: 4, extra: 'x' };

    const instance = plainToInstance(UpsertActiviteCatalogueDto, raw);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors.some((e) => e.property === 'extra')).toBe(true);
  });
});
