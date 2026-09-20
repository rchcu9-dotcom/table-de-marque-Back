import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MarquerPaiementRepasDto } from './marquer-paiement-repas.dto';
import { DefinirCommentaireOrganisateurDto } from './definir-commentaire-organisateur.dto';

async function erreurs<T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
) {
  const errors = await validate(plainToInstance(cls, plain));
  return errors.map((e) => e.property).sort();
}

describe('MarquerPaiementRepasDto', () => {
  it('accepte paye=true avec date et mode', async () => {
    expect(
      await erreurs(MarquerPaiementRepasDto, {
        paye: true,
        datePaiement: '2026-09-10',
        mode: 'AUTRE',
      }),
    ).toEqual([]);
  });

  it('accepte paye=false sans date ni mode', async () => {
    expect(await erreurs(MarquerPaiementRepasDto, { paye: false })).toEqual([]);
  });

  it('refuse paye=true sans date ni mode', async () => {
    expect(await erreurs(MarquerPaiementRepasDto, { paye: true })).toEqual([
      'datePaiement',
      'mode',
    ]);
  });

  it('refuse un mode inconnu et une date invalide', async () => {
    expect(
      await erreurs(MarquerPaiementRepasDto, {
        paye: true,
        datePaiement: 'demain',
        mode: 'ESPECES',
      }),
    ).toEqual(['datePaiement', 'mode']);
  });
});

describe('DefinirCommentaireOrganisateurDto', () => {
  it('accepte un texte libre et une chaîne vide (effacement)', async () => {
    expect(await erreurs(DefinirCommentaireOrganisateurDto, { commentaire: 'ok' })).toEqual([]);
    expect(await erreurs(DefinirCommentaireOrganisateurDto, { commentaire: '' })).toEqual([]);
  });

  it('refuse une valeur non textuelle ou trop longue (> 2000 caractères)', async () => {
    expect(await erreurs(DefinirCommentaireOrganisateurDto, { commentaire: 12 })).toEqual([
      'commentaire',
    ]);
    expect(
      await erreurs(DefinirCommentaireOrganisateurDto, { commentaire: 'x'.repeat(2001) }),
    ).toEqual(['commentaire']);
  });
});
