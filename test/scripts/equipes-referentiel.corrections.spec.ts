import {
  construireCorrections,
  corrigerListe,
  detecterAnomalies,
  versSql,
  type Correction,
  type EquipeACorriger,
  type PlanCorrections,
} from '../../scripts/equipes-referentiel/corrections-libelles.lib';

// docs/specs/-correction-des-anomalies-dans-la-liste-contexte-dans-la-lis.md
// §1, CA1 (corrections), CA2 (contrôle), CA3 (script sûr), CA9 (aucune création)

const RENARD = '\u{1F98A}';

function equipe(
  id: number,
  nom: string,
  nomComplet: string | null = null,
  inscriptions: EquipeACorriger['inscriptions'] = [],
): EquipeACorriger {
  return { id, nom, nomComplet, inscriptions };
}

/** Applique les `majs` d'un plan, comme le fait l'exécutable avec --apply. */
function appliquer(equipes: EquipeACorriger[], majs: Correction[]): EquipeACorriger[] {
  return equipes.map((e) => {
    const copie = { ...e };
    for (const maj of majs.filter((m) => m.id === e.id)) {
      if (maj.champ === 'nom') copie.nom = maj.apres as string;
      else copie.nomComplet = maj.apres;
    }
    return copie;
  });
}

const instructions = (sql: string) => sql.split('\n').filter((l) => l && !l.startsWith('--'));

describe('construireCorrections', () => {
  it('corrige les quatre anomalies de la spec quand elles sont dans nom_complet (CA1)', () => {
    const plan = construireCorrections([
      equipe(1, 'Dammarie-Cergy', 'Les Caribous de Damarie-Cergy'),
      equipe(2, 'Neuilly', 'Les Bisons de Neuilly sur Marne '),
      equipe(3, 'Trois-Chêne', `Les ${RENARD} Trois-Chêne`),
      equipe(4, 'Toulouse', 'Les Belougas De Toulouse Blagnac'),
    ]);

    expect(plan.majs).toEqual([
      {
        id: 1,
        champ: 'nomComplet',
        avant: 'Les Caribous de Damarie-Cergy',
        apres: 'Les Caribous de Dammarie-Cergy',
      },
      {
        id: 2,
        champ: 'nomComplet',
        avant: 'Les Bisons de Neuilly sur Marne ',
        apres: 'Les Bisons de Neuilly sur Marne',
      },
      {
        id: 3,
        champ: 'nomComplet',
        avant: `Les ${RENARD} Trois-Chêne`,
        apres: 'Les Trois-Chêne',
      },
      {
        id: 4,
        champ: 'nomComplet',
        avant: 'Les Belougas De Toulouse Blagnac',
        apres: 'Les Belougas de Toulouse Blagnac',
      },
    ]);
    expect(plan.aLaMain).toEqual([]);
    expect(plan.conflits).toEqual([]);
  });

  it('corrige aussi le nom court quand le libellé fautif y a été saisi, si aucune inscription ne le référence', () => {
    const plan = construireCorrections([
      equipe(1, `Les ${RENARD} Trois-Chêne`),
      equipe(2, 'Damarie-Cergy'),
    ]);

    expect(plan.majs).toEqual([
      { id: 1, champ: 'nom', avant: `Les ${RENARD} Trois-Chêne`, apres: 'Les Trois-Chêne' },
      { id: 2, champ: 'nom', avant: 'Damarie-Cergy', apres: 'Dammarie-Cergy' },
    ]);
  });

  it('ne renomme jamais le nom court d’une équipe inscrite : la correction est listée « à la main » avec ses inscriptions', () => {
    const inscriptions = [
      { id: 90, editionId: 3, equipeNom: 'Damarie-Cergy' },
      { id: 91, editionId: 4, equipeNom: 'Damarie-Cergy' },
    ];
    const plan = construireCorrections([
      equipe(2, 'Damarie-Cergy', 'Les Caribous de Damarie-Cergy', inscriptions),
    ]);

    expect(plan.aLaMain).toEqual([
      { id: 2, champ: 'nom', avant: 'Damarie-Cergy', apres: 'Dammarie-Cergy', inscriptions },
    ]);
    // Le nom complet, lui, est corrigé : il n'est recopié nulle part.
    expect(plan.majs).toEqual([
      {
        id: 2,
        champ: 'nomComplet',
        avant: 'Les Caribous de Damarie-Cergy',
        apres: 'Les Caribous de Dammarie-Cergy',
      },
    ]);
    expect(plan.majs.some((m) => m.champ === 'nom')).toBe(false);
  });

  it('signale un conflit quand le nom court corrigé est déjà porté par une autre ligne', () => {
    const plan = construireCorrections([
      equipe(1, 'Les Trois-Chêne'),
      equipe(2, `Les ${RENARD} Trois-Chêne`),
    ]);

    expect(plan.conflits).toEqual([
      {
        id: 2,
        champ: 'nom',
        avant: `Les ${RENARD} Trois-Chêne`,
        apres: 'Les Trois-Chêne',
        autreId: 1,
      },
    ]);
    expect(plan.majs).toEqual([]);
  });

  it('détecte le conflit comme la base le ferait : casse et accents ignorés', () => {
    const plan = construireCorrections([
      equipe(1, 'les trois-chene'),
      equipe(2, `Les ${RENARD} Trois-Chêne`),
    ]);

    expect(plan.conflits).toHaveLength(1);
    expect(plan.conflits[0].autreId).toBe(1);
  });

  it('signale un conflit entre deux lignes fautives qui se corrigent vers le même nom court', () => {
    const plan = construireCorrections([
      equipe(1, 'Damarie-Cergy'),
      equipe(2, `Damarie-Cergy ${RENARD}`),
    ]);

    expect(plan.majs).toEqual([
      { id: 1, champ: 'nom', avant: 'Damarie-Cergy', apres: 'Dammarie-Cergy' },
    ]);
    expect(plan.conflits.map((c) => ({ id: c.id, autreId: c.autreId }))).toEqual([
      { id: 2, autreId: 1 },
    ]);
  });

  it('ne s’applique pas à elle-même un conflit : corriger un espace final ne heurte pas sa propre ligne', () => {
    const plan = construireCorrections([equipe(1, 'Rennes ')]);

    expect(plan.conflits).toEqual([]);
    expect(plan.majs).toEqual([{ id: 1, champ: 'nom', avant: 'Rennes ', apres: 'Rennes' }]);
  });

  it('ne propose jamais un nom court vide : un libellé fait uniquement d’emoji va « à la main »', () => {
    const plan = construireCorrections([equipe(1, RENARD)]);

    expect(plan.majs).toEqual([]);
    expect(plan.aLaMain).toEqual([
      { id: 1, champ: 'nom', avant: RENARD, apres: '', inscriptions: [] },
    ]);
  });

  it('remet à NULL un nom complet qui, corrigé, devient vide ou égal au nom court', () => {
    const plan = construireCorrections([
      equipe(1, 'Rennes', RENARD),
      equipe(2, 'Dammarie-Cergy', 'Damarie-Cergy'),
      equipe(3, 'Meudon', ' meudon '),
    ]);

    expect(plan.majs).toEqual([
      { id: 1, champ: 'nomComplet', avant: RENARD, apres: null },
      { id: 2, champ: 'nomComplet', avant: 'Damarie-Cergy', apres: null },
      { id: 3, champ: 'nomComplet', avant: ' meudon ', apres: null },
    ]);
  });

  it('compare le nom complet au nom court corrigé quand celui-ci est appliqué', () => {
    const plan = construireCorrections([equipe(1, 'Damarie-Cergy', 'Dammarie-Cergy')]);

    expect(plan.majs).toEqual([
      { id: 1, champ: 'nom', avant: 'Damarie-Cergy', apres: 'Dammarie-Cergy' },
      { id: 1, champ: 'nomComplet', avant: 'Dammarie-Cergy', apres: null },
    ]);
  });

  it('ne prévoit rien pour un référentiel propre (état constaté de la base de test)', () => {
    const plan = construireCorrections([
      equipe(1, 'Les Bisons de Reims'),
      equipe(2, "Le Hormadi d'Anglet", null, [{ id: 5, editionId: 1, equipeNom: 'x' }]),
      equipe(3, 'Courbevoie', 'Les Coqs de Courbevoie'),
      equipe(4, 'Dammarie-Cergy', 'Les Caribous de Dammarie-Cergy'),
    ]);

    expect(plan).toEqual({ majs: [], aLaMain: [], conflits: [] });
  });

  it('est idempotent : une fois les corrections appliquées, un second passage ne prévoit plus rien (CA3)', () => {
    const depart = [
      equipe(1, 'Dammarie-Cergy', 'Les Caribous de Damarie-Cergy'),
      equipe(2, 'Neuilly ', 'Les Bisons de Neuilly sur Marne '),
      equipe(3, `Les ${RENARD} Trois-Chêne`, `Les ${RENARD} Trois-Chêne`),
      equipe(4, 'Toulouse', 'Les Belougas De Toulouse Blagnac'),
    ];
    const premier = construireCorrections(depart);

    const second = construireCorrections(appliquer(depart, premier.majs));

    expect(premier.majs.length).toBeGreaterThan(0);
    expect(second).toEqual({ majs: [], aLaMain: [], conflits: [] });
  });

  it('ne crée ni ne supprime aucune équipe, et ne modifie pas les données reçues (CA9)', () => {
    const depart = [
      equipe(1, 'Neuilly', 'Les Bisons de Neuilly sur Marne '),
      equipe(2, 'Rennes'),
    ];
    const copie = JSON.parse(JSON.stringify(depart));

    const plan = construireCorrections(depart);

    expect(depart).toEqual(copie);
    const idsConnus = new Set(depart.map((e) => e.id));
    for (const c of [...plan.majs, ...plan.aLaMain, ...plan.conflits]) {
      expect(idsConnus.has(c.id)).toBe(true);
    }
    expect(appliquer(depart, plan.majs)).toHaveLength(depart.length);
  });
});

describe('detecterAnomalies (contrôle du critère 2)', () => {
  it('ne signale rien sur des libellés propres', () => {
    expect(
      detecterAnomalies([
        { id: 1, nom: 'Rennes', nomComplet: null },
        { id: 2, nom: "Le Hormadi d'Anglet", nomComplet: 'Évry-Viry 2 #1' },
      ]),
    ).toEqual([]);
  });

  it('signale un espace de bord, des espaces multiples et un emoji, champ par champ', () => {
    const anomalies = detecterAnomalies([
      { id: 1, nom: 'Neuilly', nomComplet: 'Les Bisons de Neuilly sur Marne ' },
      { id: 2, nom: 'Les  Coqs', nomComplet: null },
      { id: 3, nom: `Les ${RENARD} Trois-Chêne`, nomComplet: ` ${RENARD}  x` },
    ]);

    expect(anomalies).toEqual([
      {
        id: 1,
        champ: 'nomComplet',
        valeur: 'Les Bisons de Neuilly sur Marne ',
        motifs: ['bord'],
      },
      { id: 2, champ: 'nom', valeur: 'Les  Coqs', motifs: ['espaces'] },
      { id: 3, champ: 'nom', valeur: `Les ${RENARD} Trois-Chêne`, motifs: ['emoji'] },
      {
        id: 3,
        champ: 'nomComplet',
        valeur: ` ${RENARD}  x`,
        motifs: ['bord', 'espaces', 'emoji'],
      },
    ]);
  });

  it('signale un blanc qui n’est pas un espace simple (tabulation, insécable)', () => {
    const anomalies = detecterAnomalies([
      { id: 1, nom: 'Le\u{00A0}Havre', nomComplet: 'Les\tDocks' },
    ]);

    expect(anomalies.map((a) => [a.champ, a.motifs])).toEqual([
      ['nom', ['espaces']],
      ['nomComplet', ['espaces']],
    ]);
  });

  it('ne signale pas les corrections ponctuelles (Damarie, Belougas) : ce ne sont pas des règles d’écriture', () => {
    expect(
      detecterAnomalies([
        { id: 1, nom: 'Damarie-Cergy', nomComplet: 'Les Belougas De Toulouse Blagnac' },
      ]),
    ).toEqual([]);
  });

  it('ne renvoie plus rien une fois le plan appliqué, hors lignes laissées « à la main »', () => {
    const depart = [
      equipe(1, 'Neuilly ', 'Les Bisons de Neuilly sur Marne '),
      equipe(2, `Les ${RENARD} Trois-Chêne`, `Les  ${RENARD} Trois-Chêne`),
      equipe(3, 'Toulouse ', null, [{ id: 7, editionId: 1, equipeNom: 'Toulouse ' }]),
    ];
    const plan = construireCorrections(depart);

    const restantes = detecterAnomalies(appliquer(depart, plan.majs));

    expect(detecterAnomalies(depart)).toHaveLength(5);
    expect(restantes).toEqual([{ id: 3, champ: 'nom', valeur: 'Toulouse ', motifs: ['bord'] }]);
    expect(plan.aLaMain.map((c) => c.id)).toEqual([3]);
  });
});

describe('versSql', () => {
  const plan: PlanCorrections = {
    majs: [
      { id: 2, champ: 'nomComplet', avant: "L'Oise De ", apres: "L'Oise De" },
      { id: 3, champ: 'nom', avant: `Les ${RENARD} Trois-Chêne`, apres: 'Les Trois-Chêne' },
      { id: 4, champ: 'nomComplet', avant: RENARD, apres: null },
    ],
    aLaMain: [
      {
        id: 5,
        champ: 'nom',
        avant: 'Damarie-Cergy',
        apres: 'Dammarie-Cergy',
        inscriptions: [{ id: 9, editionId: 1, equipeNom: 'Damarie-Cergy' }],
      },
    ],
    conflits: [],
  };

  it('génère un UPDATE par correction, ciblé sur id ET valeur d’origine', () => {
    expect(instructions(versSql(plan))).toEqual([
      "UPDATE `insc_equipes_referentiel` SET `nom_complet` = 'L''Oise De' WHERE `id` = 2 AND `nom_complet` = 'L''Oise De ';",
      `UPDATE \`insc_equipes_referentiel\` SET \`nom\` = 'Les Trois-Chêne' WHERE \`id\` = 3 AND \`nom\` = 'Les ${RENARD} Trois-Chêne';`,
      `UPDATE \`insc_equipes_referentiel\` SET \`nom_complet\` = NULL WHERE \`id\` = 4 AND \`nom_complet\` = '${RENARD}';`,
    ]);
  });

  it('ne contient ni création ni suppression (CA3, CA9)', () => {
    expect(versSql(plan)).not.toMatch(/\b(INSERT|DELETE|DROP|TRUNCATE|ALTER)\b/i);
  });

  it('laisse en commentaire les corrections à faire à la main, sans les exécuter', () => {
    const sql = versSql(plan);

    expect(sql).toContain('À traiter à la main (équipe #5, 1 inscription(s))');
    expect(instructions(sql).some((l) => l.includes('`id` = 5'))).toBe(false);
  });

  it('ne génère aucune instruction tant qu’un conflit d’unicité subsiste', () => {
    const sql = versSql({
      ...plan,
      conflits: [{ id: 6, champ: 'nom', avant: 'a ', apres: 'a', autreId: 1 }],
    });

    expect(instructions(sql)).toEqual([]);
    expect(sql).toMatch(/Conflit/);
  });

  it('ne génère aucune instruction quand il n’y a rien à corriger', () => {
    const sql = versSql({ majs: [], aLaMain: [], conflits: [] });

    expect(instructions(sql)).toEqual([]);
    expect(sql).toContain('Rien à corriger');
  });
});

describe('corrigerListe', () => {
  it('corrige les libellés de la liste de correspondance et dit lesquels ont changé', () => {
    const liste = [
      { nom: 'Dammarie-Cergy', nomComplet: 'Les Caribous de Damarie-Cergy' },
      { nom: 'Neuilly', nomComplet: 'Les Bisons de Neuilly sur Marne ' },
      { nom: '', nomComplet: `Les ${RENARD} Trois-Chêne` },
      { nom: 'Toulouse', nomComplet: 'Les Belougas De Toulouse Blagnac' },
      { nom: 'Rennes', nomComplet: 'Les Cormorans de Rennes' },
    ];

    const resultat = corrigerListe(liste);

    expect(resultat.liste).toEqual([
      { nom: 'Dammarie-Cergy', nomComplet: 'Les Caribous de Dammarie-Cergy' },
      { nom: 'Neuilly', nomComplet: 'Les Bisons de Neuilly sur Marne' },
      { nom: '', nomComplet: 'Les Trois-Chêne' },
      { nom: 'Toulouse', nomComplet: 'Les Belougas de Toulouse Blagnac' },
      { nom: 'Rennes', nomComplet: 'Les Cormorans de Rennes' },
    ]);
    expect(resultat.modifiees).toHaveLength(4);
    expect(resultat.modifiees[1]).toEqual({
      avant: { nom: 'Neuilly', nomComplet: 'Les Bisons de Neuilly sur Marne ' },
      apres: { nom: 'Neuilly', nomComplet: 'Les Bisons de Neuilly sur Marne' },
    });
  });

  it('corriger « Trois-Chêne » ne lui donne pas de nom court : la ligne reste exclue de la reprise', () => {
    const { liste } = corrigerListe([{ nom: '', nomComplet: `Les ${RENARD} Trois-Chêne` }]);

    expect(liste[0].nom).toBe('');
  });

  it('conserve le nombre et l’ordre des lignes, et ne modifie pas la liste reçue', () => {
    const liste = [
      { nom: 'B ', nomComplet: 'b' },
      { nom: 'A', nomComplet: 'a' },
    ];
    const copie = JSON.parse(JSON.stringify(liste));

    const resultat = corrigerListe(liste);

    expect(liste).toEqual(copie);
    expect(resultat.liste.map((l) => l.nom)).toEqual(['B', 'A']);
  });

  it('ne signale aucune modification pour une liste propre', () => {
    expect(
      corrigerListe([{ nom: 'Rennes', nomComplet: 'Les Cormorans de Rennes' }]).modifiees,
    ).toEqual([]);
  });
});
