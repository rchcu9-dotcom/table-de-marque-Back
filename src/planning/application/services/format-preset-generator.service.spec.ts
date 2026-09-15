import { FormatPresetGeneratorService } from './format-preset-generator.service';
import { FormatPhaseFinale } from '../../domain/enums/format-phase-finale.enum';
import { FormatGraphePropose } from '../../domain/repositories/format-graphe.repository';

/**
 * Vérifie l'invariant structurel commun aux 3 presets : chaque
 * (groupeOrdreSource, rangSource) ne doit apparaître qu'une seule fois dans
 * les liens proposés — un doublon écraserait silencieusement une entrée lors
 * de la persistance (FormatLien a la contrainte @@unique([groupeSourceId,
 * rangSource])), transformant un lien LIE en ELIMINE (ou l'inverse) et
 * laissant une FormatPlace orpheline dans le groupe cible.
 */
function assertAucunRangDuplique(propose: FormatGraphePropose) {
  const vus = new Map<string, string>();
  for (const lien of propose.liens) {
    const cle = `${lien.phaseOrdreSource}/${lien.groupeOrdreSource}-rang${lien.rangSource}`;
    const etatPrecedent = vus.get(cle);
    if (etatPrecedent) {
      throw new Error(
        `Rang dupliqué détecté pour ${cle} : d'abord ${etatPrecedent}, puis ${lien.etat}`,
      );
    }
    vus.set(cle, lien.etat);
  }
}

describe('FormatPresetGeneratorService', () => {
  const service = new FormatPresetGeneratorService();

  describe('POULES_FINALES', () => {
    it('génère une Phase 1 de N poules et une Phase 2 de K groupes de finale, rangs qualifiés liés et rangs non qualifiés éliminés', () => {
      const propose = service.genererGraphe(FormatPhaseFinale.POULES_FINALES, {
        nbPoules: 2,
        nbEquipesParPoule: 3,
        nbEquipesQualifieesParPoule: 1,
      });

      expect(propose.phases).toHaveLength(2);
      const [brassage, finales] = propose.phases;
      expect(brassage.groupes).toHaveLength(2);
      expect(brassage.groupes.every((g) => g.nbPlaces === 3)).toBe(true);
      expect(finales.groupes).toHaveLength(1);
      expect(finales.groupes[0].nbPlaces).toBe(2); // 1 par poule qualifiée

      const liesVersFinale = propose.liens.filter((l) => l.etat === 'LIE');
      const elimines = propose.liens.filter((l) => l.etat === 'ELIMINE');
      expect(liesVersFinale).toHaveLength(2); // rang 1 de chaque poule
      expect(elimines).toHaveLength(4); // rangs 2 et 3 de chaque poule

      expect(liesVersFinale).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            groupeOrdreSource: 1,
            rangSource: 1,
            groupeOrdreCible: 1,
            phaseOrdreCible: 2,
          }),
          expect.objectContaining({
            groupeOrdreSource: 2,
            rangSource: 1,
            groupeOrdreCible: 1,
            phaseOrdreCible: 2,
          }),
        ]),
      );

      assertAucunRangDuplique(propose);
    });

    it('produit un graphe éditable même avec un seul groupe (nbPoules=1)', () => {
      const propose = service.genererGraphe(FormatPhaseFinale.POULES_FINALES, {
        nbPoules: 1,
        nbEquipesParPoule: 4,
        nbEquipesQualifieesParPoule: 2,
      });

      expect(propose.phases[0].groupes).toHaveLength(1);
      assertAucunRangDuplique(propose);
    });
  });

  describe('CLASSEMENT_CROISE', () => {
    it('apparie les rangs croisés entre 2 poules et élimine les rangs non qualifiés', () => {
      const propose = service.genererGraphe(
        FormatPhaseFinale.CLASSEMENT_CROISE,
        { nbPoules: 2, nbEquipesParPoule: 4, nbEquipesQualifieesParPoule: 2 },
      );

      expect(propose.phases).toHaveLength(2);
      const liesVersFinale = propose.liens.filter((l) => l.etat === 'LIE');
      expect(liesVersFinale).toHaveLength(4); // 2 rangs qualifiés x 2 entrées croisées
      assertAucunRangDuplique(propose);
    });

    it("ne duplique jamais un rang emprunté par le croisement même avec un nombre de qualifiés impair (régression)", () => {
      // nbEquipesQualifieesParPoule=1 (impair) : le croisement pair/impair a besoin
      // du rang 2 de la poule B pour former la paire "1er A vs 2e B", alors que ce
      // rang est normalement au-delà de la zone "qualifiée" et serait sinon
      // re-marqué ELIMINE par la boucle d'élimination (bug corrigé lors de la
      // passe QA du 2026-09-08).
      const propose = service.genererGraphe(
        FormatPhaseFinale.CLASSEMENT_CROISE,
        { nbPoules: 2, nbEquipesParPoule: 3, nbEquipesQualifieesParPoule: 1 },
      );

      assertAucunRangDuplique(propose);

      const lienPouleBRang2 = propose.liens.find(
        (l) => l.groupeOrdreSource === 2 && l.rangSource === 2,
      );
      expect(lienPouleBRang2?.etat).toBe('LIE');
    });

    it('ne duplique jamais un rang emprunté avec 3 qualifiés (impair, second cas de croisement)', () => {
      const propose = service.genererGraphe(
        FormatPhaseFinale.CLASSEMENT_CROISE,
        { nbPoules: 2, nbEquipesParPoule: 4, nbEquipesQualifieesParPoule: 3 },
      );

      assertAucunRangDuplique(propose);
    });
  });

  describe('ELIMINATION_DIRECTE', () => {
    it('génère un bracket avec une Phase par tour jusqu’à la Finale', () => {
      const propose = service.genererGraphe(
        FormatPhaseFinale.ELIMINATION_DIRECTE,
        { nbPoules: 2, nbEquipesParPoule: 4, nbEquipesQualifieesParPoule: 2 },
      );

      // Brassage (1) + Demi-finales (2) + Finale (1) = 3 phases pour 4 qualifiés
      expect(propose.phases).toHaveLength(3);
      expect(propose.phases[0].nom).toBe('Brassage');
      expect(propose.phases[propose.phases.length - 1].groupes).toHaveLength(
        1,
      ); // 1 seul groupe en finale
      expect(
        propose.phases[propose.phases.length - 1].groupes[0].nbPlaces,
      ).toBe(2);

      assertAucunRangDuplique(propose);
    });

    it('chaque groupe de bracket (hors Brassage) a exactement 2 places (jamais de sous-bracket imbriqué)', () => {
      const propose = service.genererGraphe(
        FormatPhaseFinale.ELIMINATION_DIRECTE,
        { nbPoules: 4, nbEquipesParPoule: 4, nbEquipesQualifieesParPoule: 2 },
      );

      const phasesBracket = propose.phases.slice(1); // exclut le Brassage
      for (const phase of phasesBracket) {
        for (const groupe of phase.groupes) {
          expect(groupe.nbPlaces).toBe(2);
        }
      }
      assertAucunRangDuplique(propose);
    });

    it('marque terminaux (ELIMINE) les rangs 1 et 2 de la Finale', () => {
      const propose = service.genererGraphe(
        FormatPhaseFinale.ELIMINATION_DIRECTE,
        { nbPoules: 2, nbEquipesParPoule: 2, nbEquipesQualifieesParPoule: 1 },
      );

      const finale = propose.phases[propose.phases.length - 1];
      const liensFinale = propose.liens.filter(
        (l) =>
          l.phaseOrdreSource === finale.ordre &&
          l.groupeOrdreSource === finale.groupes[0].ordre,
      );
      expect(liensFinale).toHaveLength(2);
      expect(liensFinale.every((l) => l.etat === 'ELIMINE')).toBe(true);
    });
  });

  it('normalise des paramètres invalides (0 poule, 1 équipe/poule) sans lever d\'exception', () => {
    expect(() =>
      service.genererGraphe(FormatPhaseFinale.ELIMINATION_DIRECTE, {
        nbPoules: 0,
        nbEquipesParPoule: 1,
        nbEquipesQualifieesParPoule: 5,
      }),
    ).not.toThrow();
  });
});
