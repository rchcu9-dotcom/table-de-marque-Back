import {
  MESSAGE_NOM_COURT_VERROUILLE,
  MESSAGE_NOM_OBLIGATOIRE,
  MESSAGE_NOM_SANS_EMOJI,
  NOM_COMPLET_MAX,
  NOM_COURT_MAX,
  contientEmoji,
  estRenommage,
  normaliserEspaces,
  normaliserNomComplet,
  retirerEmoji,
} from './equipe-referentiel-noms';

// docs/specs/-correction-des-anomalies-dans-la-liste-contexte-dans-la-lis.md — §2, CA4, CA5

// Séquences construites par points de code, pour que le test ne dépende pas de
// la façon dont l'éditeur enregistre les caractères invisibles.
const RENARD = '\u{1F98A}';
const DRAPEAU_FR = '\u{1F1EB}\u{1F1F7}';
const FAMILLE_ZWJ = '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}';
const POUCE_TEINTE = '\u{1F44D}\u{1F3FD}';
const TOUCHE_1 = '1\u{FE0F}\u{20E3}';
const COEUR_VARIANTE = '\u{2764}\u{FE0F}';

describe('normaliserEspaces', () => {
  it('retire les espaces de début et de fin', () => {
    expect(normaliserEspaces('  Rennes  ')).toBe('Rennes');
    expect(normaliserEspaces('Les Bisons de Neuilly sur Marne ')).toBe(
      'Les Bisons de Neuilly sur Marne',
    );
  });

  it('réduit les suites d’espaces à un seul', () => {
    expect(normaliserEspaces('Les  Cormorans   de Rennes')).toBe('Les Cormorans de Rennes');
  });

  it('traite tabulations, retours à la ligne et espaces insécables comme des espaces', () => {
    expect(normaliserEspaces('Les\tCoqs\nde\u{00A0}Courbevoie')).toBe('Les Coqs de Courbevoie');
    expect(normaliserEspaces('\u{00A0}Rennes\u{202F}')).toBe('Rennes');
  });

  it('renvoie une chaîne vide pour une valeur faite uniquement de blancs', () => {
    expect(normaliserEspaces('')).toBe('');
    expect(normaliserEspaces(' \t\u{00A0}\n')).toBe('');
  });

  it('ne modifie ni la casse, ni les accents, ni la ponctuation', () => {
    expect(normaliserEspaces("Le Hormadi d'Anglet")).toBe("Le Hormadi d'Anglet");
    expect(normaliserEspaces('Les Belougas De Toulouse')).toBe('Les Belougas De Toulouse');
    expect(normaliserEspaces('Trois-Chêne')).toBe('Trois-Chêne');
  });

  it('est idempotente', () => {
    const une = normaliserEspaces('  Les  Coqs\tde Courbevoie ');
    expect(normaliserEspaces(une)).toBe(une);
  });
});

describe('contientEmoji', () => {
  it.each([
    ['pictogramme', `Les ${RENARD} Trois-Chêne`],
    ['pictogramme seul', RENARD],
    ['drapeau (indicateurs régionaux)', `France ${DRAPEAU_FR}`],
    ['séquence à liant ZWJ', FAMILLE_ZWJ],
    ['pictogramme avec teinte', POUCE_TEINTE],
    ['symbole avec sélecteur de variante', COEUR_VARIANTE],
  ])('détecte un emoji : %s', (_cas, valeur) => {
    expect(contientEmoji(valeur)).toBe(true);
  });

  it.each([
    ['lettres accentuées', 'Trois-Chêne'],
    ['majuscule accentuée et tiret', 'Évry-Viry'],
    ['apostrophes droite et typographique', "Le Hormadi d'Anglet d’ici"],
    ['chiffres', 'Amical 1'],
    ['dièse, astérisque, esperluette, point', 'Club #1 * HC & Co.'],
    ['ligature et c cédille', 'Cœur de François'],
    ['chaîne vide', ''],
  ])('ne prend pas pour un emoji : %s', (_cas, valeur) => {
    expect(contientEmoji(valeur)).toBe(false);
  });

  it('donne le même résultat à chaque appel (pas d’état conservé entre deux tests)', () => {
    const valeur = `Les ${RENARD} Trois-Chêne`;
    expect([1, 2, 3, 4].map(() => contientEmoji(valeur))).toEqual([true, true, true, true]);
  });
});

describe('retirerEmoji', () => {
  it('corrige « Les 🦊 Trois-Chêne » en « Les Trois-Chêne », avec un seul espace', () => {
    expect(retirerEmoji(`Les ${RENARD} Trois-Chêne`)).toBe('Les Trois-Chêne');
  });

  it.each([
    ['drapeau', `France ${DRAPEAU_FR}`, 'France'],
    ['séquence à liant ZWJ', `Famille ${FAMILLE_ZWJ} HC`, 'Famille HC'],
    ['pictogramme avec teinte', `Club ${POUCE_TEINTE}`, 'Club'],
    ['touche combinante', `Tel ${TOUCHE_1} ok`, 'Tel 1 ok'],
    ['symbole avec sélecteur de variante', `Cœur ${COEUR_VARIANTE} HC`, 'Cœur HC'],
    ['emoji collé au texte', `Rennes${RENARD}HC`, 'Rennes HC'],
    ['plusieurs emoji', `${RENARD}${RENARD} Rennes ${RENARD}`, 'Rennes'],
  ])('ne laisse aucun caractère résiduel : %s', (_cas, valeur, attendu) => {
    const resultat = retirerEmoji(valeur);

    expect(resultat).toBe(attendu);
    expect(contientEmoji(resultat)).toBe(false);
    expect(resultat).not.toMatch(/\u{200D}|\u{FE0F}|\u{20E3}/u);
  });

  it('renvoie une chaîne vide pour un libellé fait uniquement d’emoji', () => {
    expect(retirerEmoji(`${RENARD} ${DRAPEAU_FR}`)).toBe('');
  });

  it('laisse intact un libellé sans emoji, hors espaces parasites', () => {
    expect(retirerEmoji("Le Hormadi d'Anglet")).toBe("Le Hormadi d'Anglet");
    expect(retirerEmoji(' Trois-Chêne  2 ')).toBe('Trois-Chêne 2');
  });
});

describe('messages de refus', () => {
  it('portent les libellés attendus par la spec et par le front', () => {
    expect(MESSAGE_NOM_SANS_EMOJI).toBe("Le nom ne doit pas contenir d'emoji");
    expect(MESSAGE_NOM_OBLIGATOIRE).toBe('Le nom est obligatoire');
  });
});

describe('normaliserNomComplet — espaces (anomalies)', () => {
  it('réduit les espaces multiples et retire les espaces de bord (CA4)', () => {
    expect(normaliserNomComplet('Rennes', 'Les  Cormorans de Rennes ')).toBe(
      'Les Cormorans de Rennes',
    );
  });

  it('compare au nom court après normalisation des espaces des deux côtés', () => {
    expect(normaliserNomComplet('Le  Havre', ' le havre ')).toBeNull();
    expect(normaliserNomComplet('Le Havre', 'Le\u{00A0}Havre')).toBeNull();
  });

  it('ne retire pas un emoji : c’est le cas d’usage qui le refuse', () => {
    expect(normaliserNomComplet('Rennes', `Les ${RENARD} de Rennes`)).toBe(
      `Les ${RENARD} de Rennes`,
    );
  });
});

// docs/specs/-prise-en-compte-du-nom-court-pour-les-logos-contexte-actuel.md — CA6
describe('normaliserNomComplet', () => {
  it('conserve un nom complet distinct du nom court', () => {
    expect(normaliserNomComplet('Courbevoie', 'Les Coqs de Courbevoie')).toBe(
      'Les Coqs de Courbevoie',
    );
  });

  it('retire les espaces de début et de fin', () => {
    expect(normaliserNomComplet('Courbevoie', '  Les Coqs de Courbevoie  ')).toBe(
      'Les Coqs de Courbevoie',
    );
  });

  it.each([undefined, null, '', '   ', '\t\n'])(
    'renvoie null quand le nom complet est absent ou vide (%p)',
    (valeur) => {
      expect(normaliserNomComplet('Rennes', valeur)).toBeNull();
    },
  );

  it('renvoie null quand le nom complet est identique au nom court', () => {
    expect(normaliserNomComplet('Rennes', 'Rennes')).toBeNull();
  });

  it('ignore la casse et les espaces de bord pour comparer au nom court', () => {
    expect(normaliserNomComplet('Rennes', '  RENNES ')).toBeNull();
    expect(normaliserNomComplet(' rennes ', 'Rennes')).toBeNull();
  });

  it('ne confond pas un nom complet qui contient seulement le nom court', () => {
    expect(normaliserNomComplet('Rennes', 'Rennes Cormorans')).toBe('Rennes Cormorans');
  });

  it('expose la longueur maximale du nom complet (colonne VARCHAR(150))', () => {
    expect(NOM_COMPLET_MAX).toBe(150);
  });
});

// docs/specs/recommandations-finales-contexte-la-mise-en-place-de-la-colo.md — §4, CA5, CA7
describe('estRenommage', () => {
  it('renvoie false pour un nom identique', () => {
    expect(estRenommage('Courbevoie', 'Courbevoie')).toBe(false);
  });

  it.each([
    ['espaces de bord', '  Courbevoie  '],
    ['espaces doublés', 'Trois  Chêne'],
    ['tabulation', 'Trois\tChêne'],
  ])('ne compte pas une différence d’espaces seule (%s)', (_cas, demande) => {
    const actuel = demande.includes('Trois') ? 'Trois Chêne' : 'Courbevoie';
    expect(estRenommage(actuel, demande)).toBe(false);
  });

  it.each([
    ['casse', 'Orleans', 'orleans'],
    ['accent', 'Orleans', 'Orléans'],
    ['tiret', 'Trois Chêne', 'Trois-Chêne'],
    ['mot ajouté', 'Rennes', 'Rennes Cormorans'],
    ['autre nom', 'Rennes', 'Brest'],
  ])('compte comme un renommage un changement de %s', (_cas, actuel, demande) => {
    expect(estRenommage(actuel, demande)).toBe(true);
  });

  it('expose la longueur maximale du nom court (colonne VARCHAR(100))', () => {
    expect(NOM_COURT_MAX).toBe(100);
  });

  it('expose le message du verrou, repris tel quel par le front', () => {
    expect(MESSAGE_NOM_COURT_VERROUILLE).toBe(
      'Le nom court ne peut plus être modifié : une candidature fait référence à cette équipe',
    );
  });
});
