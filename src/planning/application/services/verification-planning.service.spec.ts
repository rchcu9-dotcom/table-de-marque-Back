import { VerificationPlanningService } from './verification-planning.service';
import {
  makeActiviteGeneree,
  makeEquipesReelles,
  makeJour,
  makeMatchGenere,
} from './__fixtures__/planning.fixtures';

const HEURE_DEBUT = new Date('2026-05-23T09:00:00.000Z');
const HEURE_FIN = new Date('2026-05-23T21:30:00.000Z');
const REPAS_ID = 10;

function baseJour() {
  return makeJour({ numeroJour: 1, heureDebut: HEURE_DEBUT, heureFin: HEURE_FIN });
}

describe('VerificationPlanningService', () => {
  let service: VerificationPlanningService;

  beforeEach(() => {
    service = new VerificationPlanningService();
  });

  it("ne remonte aucune violation sur un planning propre sans équipe fictive", () => {
    const jour = baseJour();
    const matches = [
      makeMatchGenere({
        numMatch: 1,
        jour: 1,
        equipe1Ref: 'real:1',
        equipe2Ref: 'real:2',
        dateHeure: new Date('2026-05-23T09:00:00.000Z'),
        dureeMin: 27,
      }),
    ];
    const violations = service.verifier({
      matches,
      activites: [],
      jours: [jour],
      delaiMinActivite: null,
      nbPatinoires: 2,
      equipes: makeEquipesReelles(2),
    });
    expect(violations).toEqual([]);
  });

  it("détecte un conflit d'équipe (deux activités qui se chevauchent)", () => {
    const jour = baseJour();
    const matches = [
      makeMatchGenere({
        numMatch: 1,
        jour: 1,
        equipe1Ref: 'real:1',
        equipe2Ref: 'real:2',
        dateHeure: new Date('2026-05-23T09:00:00.000Z'),
        dureeMin: 27,
      }),
      makeMatchGenere({
        numMatch: 2,
        jour: 1,
        equipe1Ref: 'real:1',
        equipe2Ref: 'real:3',
        dateHeure: new Date('2026-05-23T09:10:00.000Z'),
        dureeMin: 27,
      }),
    ];
    const violations = service.verifier({
      matches,
      activites: [],
      jours: [jour],
      delaiMinActivite: null,
      nbPatinoires: 2,
      equipes: makeEquipesReelles(3),
    });
    expect(violations.some((v) => v.includes('chevauchement'))).toBe(true);
  });

  it('détecte un dépassement de la plage horaire journalière pour un match (avant le début)', () => {
    const jour = baseJour();
    const matches = [
      makeMatchGenere({
        numMatch: 1,
        jour: 1,
        equipe1Ref: 'real:1',
        equipe2Ref: 'real:2',
        dateHeure: new Date('2026-05-23T08:30:00.000Z'),
        dureeMin: 20,
      }),
    ];
    const violations = service.verifier({
      matches,
      activites: [],
      jours: [jour],
      delaiMinActivite: null,
      nbPatinoires: 2,
      equipes: makeEquipesReelles(2),
    });
    expect(violations.some((v) => v.includes('avant le début de la journée'))).toBe(true);
  });

  it('détecte un dépassement de la plage horaire journalière pour un match (après la fin)', () => {
    const jour = baseJour();
    const matches = [
      makeMatchGenere({
        numMatch: 1,
        jour: 1,
        equipe1Ref: 'real:1',
        equipe2Ref: 'real:2',
        dateHeure: new Date('2026-05-23T21:20:00.000Z'),
        dureeMin: 27,
      }),
    ];
    const violations = service.verifier({
      matches,
      activites: [],
      jours: [jour],
      delaiMinActivite: null,
      nbPatinoires: 2,
      equipes: makeEquipesReelles(2),
    });
    expect(violations.some((v) => v.includes('après la fin de la journée'))).toBe(true);
  });

  it("ne vérifie plus les bornes de journée pour une activité (§2.3 : aucun lien créneau ↔ jour en v1)", () => {
    const jour = baseJour();
    // Activité largement hors de la plage horaire du jour (avant 09:00) :
    // ne doit produire aucune violation de bornes, contrairement à un match.
    const activites = [
      makeActiviteGeneree({
        equipeRef: 'real:1',
        activiteId: REPAS_ID,
        debut: new Date('2026-05-23T03:00:00.000Z'),
        fin: new Date('2026-05-23T03:40:00.000Z'),
      }),
    ];
    const violations = service.verifier({
      matches: [],
      activites,
      jours: [jour],
      delaiMinActivite: null,
      nbPatinoires: 2,
      equipes: makeEquipesReelles(1),
    });
    expect(violations.some((v) => v.includes('avant le début de la journée'))).toBe(false);
    expect(violations.some((v) => v.includes('après la fin de la journée'))).toBe(false);
  });

  it('détecte un délai minimum non respecté entre un match et une activité du catalogue, avec le déficit en minutes', () => {
    const jour = baseJour();
    const matches = [
      makeMatchGenere({
        numMatch: 1,
        jour: 1,
        equipe1Ref: 'real:1',
        equipe2Ref: 'real:2',
        dateHeure: new Date('2026-05-23T09:00:00.000Z'),
        dureeMin: 27,
      }),
    ];
    const activites = [
      makeActiviteGeneree({
        equipeRef: 'real:1',
        activiteId: REPAS_ID,
        debut: new Date('2026-05-23T09:30:00.000Z'),
        fin: new Date('2026-05-23T10:00:00.000Z'),
      }),
    ];
    const violations = service.verifier({
      matches,
      activites,
      jours: [jour],
      // Clé générique désormais : String(activiteId) au lieu du littéral 'repas'.
      delaiMinActivite: { match: { [REPAS_ID]: 60 } },
      nbPatinoires: 2,
      equipes: makeEquipesReelles(2),
    });
    expect(
      violations.some((v) => v.includes(`délai match→${REPAS_ID}`) && v.includes('déficit')),
    ).toBe(true);
  });

  it('ne signale aucun délai insuffisant quand le gap respecte la matrice', () => {
    const jour = baseJour();
    const matches = [
      makeMatchGenere({
        numMatch: 1,
        jour: 1,
        equipe1Ref: 'real:1',
        equipe2Ref: 'real:2',
        dateHeure: new Date('2026-05-23T09:00:00.000Z'),
        dureeMin: 27,
      }),
    ];
    const activites = [
      makeActiviteGeneree({
        equipeRef: 'real:1',
        activiteId: REPAS_ID,
        debut: new Date('2026-05-23T10:30:00.000Z'),
        fin: new Date('2026-05-23T11:00:00.000Z'),
      }),
    ];
    const violations = service.verifier({
      matches,
      activites,
      jours: [jour],
      delaiMinActivite: { match: { [REPAS_ID]: 60 } },
      nbPatinoires: 2,
      equipes: makeEquipesReelles(2),
    });
    expect(violations.some((v) => v.includes('délai'))).toBe(false);
  });

  it('détecte une surcharge de patinoires (plus de matchs simultanés que de patinoires disponibles)', () => {
    const jour = baseJour();
    const meme = new Date('2026-05-23T09:00:00.000Z');
    const matches = [
      makeMatchGenere({ numMatch: 1, jour: 1, equipe1Ref: 'real:1', equipe2Ref: 'real:2', dateHeure: meme }),
      makeMatchGenere({ numMatch: 2, jour: 1, equipe1Ref: 'real:3', equipe2Ref: 'real:4', dateHeure: meme }),
      makeMatchGenere({ numMatch: 3, jour: 1, equipe1Ref: 'real:5', equipe2Ref: 'real:6', dateHeure: meme }),
    ];
    const violations = service.verifier({
      matches,
      activites: [],
      jours: [jour],
      delaiMinActivite: null,
      nbPatinoires: 2,
      equipes: makeEquipesReelles(6),
    });
    expect(violations.some((v) => v.includes('matchs simultanés'))).toBe(true);
  });

  it("ne signale pas de surcharge patinoires quand le nombre de matchs simultanés est couvert", () => {
    const jour = baseJour();
    const meme = new Date('2026-05-23T09:00:00.000Z');
    const matches = [
      makeMatchGenere({ numMatch: 1, jour: 1, equipe1Ref: 'real:1', equipe2Ref: 'real:2', dateHeure: meme }),
      makeMatchGenere({ numMatch: 2, jour: 1, equipe1Ref: 'real:3', equipe2Ref: 'real:4', dateHeure: meme }),
    ];
    const violations = service.verifier({
      matches,
      activites: [],
      jours: [jour],
      delaiMinActivite: null,
      nbPatinoires: 2,
      equipes: makeEquipesReelles(4),
    });
    expect(violations.some((v) => v.includes('matchs simultanés'))).toBe(false);
  });

  it("signale la présence d'équipes fictives (bloquant par défaut pour la confirmation)", () => {
    const jour = baseJour();
    const equipes = [
      ...makeEquipesReelles(1),
      { ref: 'fictive:1', nom: 'Équipe 1', fictive: true, equipeId: null } as any,
    ];
    const violations = service.verifier({
      matches: [],
      activites: [],
      jours: [jour],
      delaiMinActivite: null,
      nbPatinoires: 2,
      equipes,
    });
    expect(violations.some((v) => v.includes('équipe(s) fictive(s)'))).toBe(true);
  });

  it("ne signale rien sur les équipes fictives si toutes les équipes sont réelles", () => {
    const jour = baseJour();
    const violations = service.verifier({
      matches: [],
      activites: [],
      jours: [jour],
      delaiMinActivite: null,
      nbPatinoires: 2,
      equipes: makeEquipesReelles(4),
    });
    expect(violations.some((v) => v.includes('fictive'))).toBe(false);
  });
});
