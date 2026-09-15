import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertJourDto } from './upsert-jour.dto';

/**
 * Régression : le ValidationPipe global (main.ts) tourne avec
 * whitelist + forbidNonWhitelisted. Un champ sans aucun décorateur
 * class-validator (ex. seulement @Type()) est traité comme une
 * propriété inconnue et rejeté ("property X should not exist"),
 * même si la classe la déclare. Ce test rejoue exactement cette
 * configuration pour empêcher qu'un futur champ retombe dans ce piège.
 */
describe('UpsertJourDto', () => {
  it('valide un payload de création/mise à jour de jour tel qu\'envoyé par le front', async () => {
    const raw = {
      numeroJour: 1,
      date: '2026-05-23',
      heureDebut: '2026-05-23T09:00:00.000Z',
      heureFin: '2026-05-23T21:30:00.000Z',
      typeJournee: '5V5',
    };

    const instance = plainToInstance(UpsertJourDto, raw);
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toHaveLength(0);
  });

  it('rejette un typeJournee hors énumération', async () => {
    const raw = {
      numeroJour: 1,
      date: '2026-05-23',
      heureDebut: '2026-05-23T09:00:00.000Z',
      heureFin: '2026-05-23T21:30:00.000Z',
      typeJournee: 'INVALIDE',
    };

    const instance = plainToInstance(UpsertJourDto, raw);
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.some((e) => e.property === 'typeJournee')).toBe(true);
  });
});
