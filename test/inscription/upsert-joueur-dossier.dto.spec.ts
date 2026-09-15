import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateJoueurDossierDto,
  UpdateJoueurDossierDto,
} from '@/inscription/application/dossier/dto/upsert-joueur-dossier.dto';

/**
 * Teste le jeu fermé de postes (@IsIn) et l'obligation d'anneeNaissance à la
 * création, au niveau où NestJS les applique réellement : le pipeline de
 * validation class-validator, pas l'exécution du use case (qui reçoit un
 * DTO déjà validé en production).
 */
describe('CreateJoueurDossierDto', () => {
  const BASE_VALID = {
    nom: 'Gretzky',
    prenom: 'Wayne',
    numero: 99,
    poste: 'D',
    anneeNaissance: 2015,
  };

  it('is valid with a poste in the closed enum (D/DEF/ATT) and a numeric anneeNaissance', async () => {
    const dto = plainToInstance(CreateJoueurDossierDto, BASE_VALID);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it.each(['DEF', 'ATT'])('accepts poste=%s', async (poste) => {
    const dto = plainToInstance(CreateJoueurDossierDto, { ...BASE_VALID, poste });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it.each(['GARDIEN', 'G', 'A', ''])(
    'rejects poste=%s (CA6 — hors du jeu fermé D/DEF/ATT)',
    async (poste) => {
      const dto = plainToInstance(CreateJoueurDossierDto, { ...BASE_VALID, poste });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'poste')).toBe(true);
    },
  );

  it('rejects a missing anneeNaissance (CA3 — obligatoire à la création)', async () => {
    const { anneeNaissance: _omitted, ...rest } = BASE_VALID;
    const dto = plainToInstance(CreateJoueurDossierDto, rest);
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'anneeNaissance')).toBe(true);
  });

  it('rejects a non-integer anneeNaissance', async () => {
    const dto = plainToInstance(CreateJoueurDossierDto, {
      ...BASE_VALID,
      anneeNaissance: 'pas-un-nombre',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'anneeNaissance')).toBe(true);
  });
});

describe('UpdateJoueurDossierDto', () => {
  it('is valid when anneeNaissance is omitted (mise à jour partielle)', async () => {
    const dto = plainToInstance(UpdateJoueurDossierDto, { nom: 'Lemieux' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it.each(['DEF', 'ATT', 'D'])('accepts poste=%s when provided', async (poste) => {
    const dto = plainToInstance(UpdateJoueurDossierDto, { poste });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a poste outside the closed enum when provided', async () => {
    const dto = plainToInstance(UpdateJoueurDossierDto, { poste: 'GARDIEN' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'poste')).toBe(true);
  });
});
