import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertCreneauActiviteDto } from './upsert-creneau-activite.dto';

/**
 * Régression : le ValidationPipe global (main.ts) tourne avec
 * whitelist + forbidNonWhitelisted — un champ non décoré ou une valeur hors
 * contrainte doit être rejeté explicitement, jamais silencieusement ignoré.
 */
describe('UpsertCreneauActiviteDto', () => {
  it('valide un payload de création tel qu\'envoyé par le front', async () => {
    const raw = {
      activiteId: 10,
      date: '2026-05-23',
      heureDebut: '2026-05-23T12:00:00.000Z',
      dureeMin: 40,
    };

    const instance = plainToInstance(UpsertCreneauActiviteDto, raw);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors).toHaveLength(0);
  });

  it('rejette une date invalide', async () => {
    const raw = {
      activiteId: 10,
      date: 'pas-une-date',
      heureDebut: '2026-05-23T12:00:00.000Z',
      dureeMin: 40,
    };

    const instance = plainToInstance(UpsertCreneauActiviteDto, raw);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors.some((e) => e.property === 'date')).toBe(true);
  });

  it('rejette une dureeMin nulle ou négative', async () => {
    const raw = {
      activiteId: 10,
      date: '2026-05-23',
      heureDebut: '2026-05-23T12:00:00.000Z',
      dureeMin: 0,
    };

    const instance = plainToInstance(UpsertCreneauActiviteDto, raw);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors.some((e) => e.property === 'dureeMin')).toBe(true);
  });

  it('rejette un champ additionnel non whitelisté (ex. equipeId saisi manuellement par erreur)', async () => {
    const raw = {
      activiteId: 10,
      date: '2026-05-23',
      heureDebut: '2026-05-23T12:00:00.000Z',
      dureeMin: 40,
      equipeId: 1,
    };

    const instance = plainToInstance(UpsertCreneauActiviteDto, raw);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors.some((e) => e.property === 'equipeId')).toBe(true);
  });
});
