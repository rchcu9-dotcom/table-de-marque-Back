import { corrigerLibelle } from './equipe-referentiel-corrections';

// docs/specs/-correction-des-anomalies-dans-la-liste-contexte-dans-la-lis.md — §1, CA1

const RENARD = '\u{1F98A}';

describe('corrigerLibelle', () => {
  describe('les quatre anomalies de la liste', () => {
    it('ligne 1 — écrit Dammarie avec deux « m », comme le nom court', () => {
      expect(corrigerLibelle('Damarie-Cergy')).toBe('Dammarie-Cergy');
      expect(corrigerLibelle('Les Caribous de Damarie-Cergy')).toBe(
        'Les Caribous de Dammarie-Cergy',
      );
    });

    it('ligne 2 — retire l’espace final', () => {
      expect(corrigerLibelle('Les Bisons de Neuilly sur Marne ')).toBe(
        'Les Bisons de Neuilly sur Marne',
      );
    });

    it('ligne 3 — retire l’emoji sans laisser de double espace', () => {
      expect(corrigerLibelle(`Les ${RENARD} Trois-Chêne`)).toBe('Les Trois-Chêne');
    });

    it('ligne 4 — met « de » en minuscule dans le libellé des Belougas', () => {
      expect(corrigerLibelle('Les Belougas De Toulouse Blagnac')).toBe(
        'Les Belougas de Toulouse Blagnac',
      );
    });
  });

  describe('Damarie → Dammarie', () => {
    it('ne touche pas un « Dammarie » déjà correct', () => {
      expect(corrigerLibelle('Dammarie-Cergy')).toBe('Dammarie-Cergy');
      expect(corrigerLibelle('Dammarie')).toBe('Dammarie');
    });

    it('corrige chaque occurrence du mot entier', () => {
      expect(corrigerLibelle('Damarie et Damarie-Cergy')).toBe('Dammarie et Dammarie-Cergy');
    });

    it('ne remplace que le mot entier, pas une partie d’un autre mot', () => {
      expect(corrigerLibelle('Damariens')).toBe('Damariens');
      expect(corrigerLibelle('Sandamarie')).toBe('Sandamarie');
    });
  });

  describe('Belougas', () => {
    it('ne met pas en minuscule le « De » d’un autre libellé (correction ponctuelle, pas une règle)', () => {
      expect(corrigerLibelle('Les Ducs De Dijon')).toBe('Les Ducs De Dijon');
      expect(corrigerLibelle('Les Belougas De Toulouse')).toBe('Les Belougas De Toulouse');
    });

    it('s’applique aussi quand le libellé porte en plus un espace parasite ou un emoji', () => {
      expect(corrigerLibelle(' Les Belougas  De Toulouse Blagnac ')).toBe(
        'Les Belougas de Toulouse Blagnac',
      );
      expect(corrigerLibelle(`Les Belougas De Toulouse Blagnac ${RENARD}`)).toBe(
        'Les Belougas de Toulouse Blagnac',
      );
    });
  });

  it('cumule les corrections sur un même libellé', () => {
    expect(corrigerLibelle(`  Les ${RENARD}  Caribous de Damarie-Cergy `)).toBe(
      'Les Caribous de Dammarie-Cergy',
    );
  });

  it.each([
    'Rennes',
    'Les Coqs de Courbevoie',
    "Le Hormadi d'Anglet",
    'Trois-Chêne',
    'Évry-Viry',
    'Amical 1',
    '',
  ])('laisse intact un libellé propre : %p', (libelle) => {
    expect(corrigerLibelle(libelle)).toBe(libelle);
  });

  it('est idempotente : corriger un libellé corrigé ne change plus rien', () => {
    for (const fautif of [
      'Damarie-Cergy',
      'Les Bisons de Neuilly sur Marne ',
      `Les ${RENARD} Trois-Chêne`,
      'Les Belougas De Toulouse Blagnac',
    ]) {
      const corrige = corrigerLibelle(fautif);
      expect(corrigerLibelle(corrige)).toBe(corrige);
    }
  });
});
