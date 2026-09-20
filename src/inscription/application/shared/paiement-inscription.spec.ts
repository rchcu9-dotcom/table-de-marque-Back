import {
  STATUTS_FRAIS_INSCRIPTION_PAYE,
  derivePaiementInscription,
} from './paiement-inscription';

const TOUS_LES_STATUTS = [
  'CANDIDATE',
  'LISTE_ATTENTE',
  'REFUSEE',
  'RESERVEE',
  'PAIEMENT_ATTENDU',
  'VALIDEE',
  'DOSSIER_EN_COURS',
  'DOSSIER_COMPLET',
];

const STATUTS_PAYES = ['VALIDEE', 'DOSSIER_EN_COURS', 'DOSSIER_COMPLET'];
const STATUTS_NON_PAYES = TOUS_LES_STATUTS.filter((s) => !STATUTS_PAYES.includes(s));

describe('paiement-inscription', () => {
  describe('STATUTS_FRAIS_INSCRIPTION_PAYE', () => {
    it('contient exactement VALIDEE, DOSSIER_EN_COURS et DOSSIER_COMPLET', () => {
      expect([...STATUTS_FRAIS_INSCRIPTION_PAYE].sort()).toEqual([...STATUTS_PAYES].sort());
    });
  });

  describe('derivePaiementInscription()', () => {
    describe('fraisInscriptionPaye (dérivé du statut)', () => {
      it.each(STATUTS_PAYES)('statut %s → frais payés', (statut) => {
        expect(derivePaiementInscription({ statut }).fraisInscriptionPaye).toBe(true);
      });

      it.each(STATUTS_NON_PAYES)('statut %s → frais non payés', (statut) => {
        expect(derivePaiementInscription({ statut }).fraisInscriptionPaye).toBe(false);
      });

      it('un statut inconnu est traité comme non payé', () => {
        expect(derivePaiementInscription({ statut: 'INCONNU' }).fraisInscriptionPaye).toBe(false);
      });

      it('ne dépend pas du dossier', () => {
        const result = derivePaiementInscription({
          statut: 'PAIEMENT_ATTENDU',
          dossier: { repasPaiementRecu: true, joueurs: [{}, {}] },
        });
        expect(result.fraisInscriptionPaye).toBe(false);
      });
    });

    describe('sans dossier', () => {
      it('dossier null → 0 joueur, repas non payé', () => {
        expect(derivePaiementInscription({ statut: 'VALIDEE', dossier: null })).toEqual({
          nbJoueurs: 0,
          fraisInscriptionPaye: true,
          repasPaiementRecu: false,
        });
      });

      it('dossier absent (clé non renseignée) → 0 joueur, repas non payé', () => {
        expect(derivePaiementInscription({ statut: 'PAIEMENT_ATTENDU' })).toEqual({
          nbJoueurs: 0,
          fraisInscriptionPaye: false,
          repasPaiementRecu: false,
        });
      });
    });

    describe('avec dossier', () => {
      it.each([0, 1, 3, 15])('nbJoueurs = nombre de lignes joueurs (%i)', (n) => {
        const joueurs = Array.from({ length: n }, (_, i) => ({ id: i }));
        const result = derivePaiementInscription({
          statut: 'DOSSIER_EN_COURS',
          dossier: { repasPaiementRecu: false, joueurs },
        });
        expect(result.nbJoueurs).toBe(n);
      });

      it.each([true, false])('repasPaiementRecu = %s est repris tel quel', (recu) => {
        const result = derivePaiementInscription({
          statut: 'DOSSIER_EN_COURS',
          dossier: { repasPaiementRecu: recu, joueurs: [] },
        });
        expect(result.repasPaiementRecu).toBe(recu);
      });

      it('combine les trois champs (AC : 3 joueurs, repas payé, frais payés)', () => {
        expect(
          derivePaiementInscription({
            statut: 'DOSSIER_COMPLET',
            dossier: { repasPaiementRecu: true, joueurs: [{}, {}, {}] },
          }),
        ).toEqual({ nbJoueurs: 3, fraisInscriptionPaye: true, repasPaiementRecu: true });
      });
    });

    it('ne renvoie que les trois champs du contrat de paiement', () => {
      const result = derivePaiementInscription({
        statut: 'VALIDEE',
        dossier: { repasPaiementRecu: false, joueurs: [] },
      });
      expect(Object.keys(result).sort()).toEqual(
        ['fraisInscriptionPaye', 'nbJoueurs', 'repasPaiementRecu'].sort(),
      );
    });
  });
});
