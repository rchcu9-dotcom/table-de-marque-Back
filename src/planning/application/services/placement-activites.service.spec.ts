import { PlacementActivitesService } from './placement-activites.service';
import {
  makeActiviteCatalogue,
  makeCreneauActivite,
  makeEquipesReelles,
  makeMatchGenere,
} from './__fixtures__/planning.fixtures';

const REPAS_ID = 10;
const CHALLENGE_ID = 20;
const JOUR = new Date('2026-05-23T00:00:00.000Z');

const CATALOGUE = [
  makeActiviteCatalogue({ id: REPAS_ID, label: 'Repas' }),
  makeActiviteCatalogue({ id: CHALLENGE_ID, label: 'Challenge' }),
];

function candidatsDe(n: number) {
  return makeEquipesReelles(n).map((e) => ({ ref: e.ref, nom: e.nom }));
}

describe('PlacementActivitesService', () => {
  let service: PlacementActivitesService;

  beforeEach(() => {
    service = new PlacementActivitesService();
  });

  it("ne place rien et renvoie un score nul si aucun candidat n'est fourni", () => {
    const { assignations, score } = service.placerActivitesJour({
      candidats: [],
      matchesDuJour: [],
      creneauxDuJour: [makeCreneauActivite({ activiteId: REPAS_ID })],
      activites: CATALOGUE,
      delaiMinActivite: null,
    });
    expect(assignations).toEqual([]);
    expect(score).toEqual({ penalty: 0, slack: 0 });
  });

  it("ne place rien et renvoie un score nul s'il n'y a aucun créneau ce jour-là", () => {
    const { assignations, score } = service.placerActivitesJour({
      candidats: candidatsDe(2),
      matchesDuJour: [],
      creneauxDuJour: [],
      activites: CATALOGUE,
      delaiMinActivite: null,
    });
    expect(assignations).toEqual([]);
    expect(score).toEqual({ penalty: 0, slack: 0 });
  });

  it('attribue exactement une activité par candidat pour chaque activité disposant de suffisamment de créneaux', () => {
    const candidats = candidatsDe(4);
    const creneauxChallenge = [0, 1, 2, 3].map((i) =>
      makeCreneauActivite({
        id: 100 + i,
        activiteId: CHALLENGE_ID,
        heureDebut: new Date(JOUR.getTime() + 9 * 3_600_000 + i * 40 * 60_000),
        dureeMin: 40,
      }),
    );
    const creneauxRepas = [0, 1, 2, 3].map((i) =>
      makeCreneauActivite({
        id: 200 + i,
        activiteId: REPAS_ID,
        heureDebut: new Date(JOUR.getTime() + 12 * 3_600_000 + i * 60_000),
        dureeMin: 40,
      }),
    );

    const { assignations } = service.placerActivitesJour({
      candidats,
      matchesDuJour: [],
      creneauxDuJour: [...creneauxChallenge, ...creneauxRepas],
      activites: CATALOGUE,
      delaiMinActivite: null,
    });

    for (const candidat of candidats) {
      const repas = assignations.filter((a) => a.equipeRef === candidat.ref && a.activiteId === REPAS_ID);
      const challenge = assignations.filter(
        (a) => a.equipeRef === candidat.ref && a.activiteId === CHALLENGE_ID,
      );
      expect(repas).toHaveLength(1);
      expect(challenge).toHaveLength(1);
    }
  });

  it('calcule debut/fin de chaque assignation à partir de heureDebut et dureeMin du créneau (pas d\'horaire généré)', () => {
    const heureDebut = new Date('2026-05-23T12:00:00.000Z');
    const creneau = makeCreneauActivite({ activiteId: REPAS_ID, heureDebut, dureeMin: 25 });

    const { assignations } = service.placerActivitesJour({
      candidats: candidatsDe(1),
      matchesDuJour: [],
      creneauxDuJour: [creneau],
      activites: CATALOGUE,
      delaiMinActivite: null,
    });

    expect(assignations[0].debut).toEqual(heureDebut);
    expect(assignations[0].fin.getTime() - assignations[0].debut.getTime()).toBe(25 * 60_000);
  });

  it("reporte le label et l'id de l'activité du catalogue, et l'id du créneau consommé, sur l'assignation", () => {
    const creneau = makeCreneauActivite({ id: 42, activiteId: REPAS_ID });

    const { assignations } = service.placerActivitesJour({
      candidats: candidatsDe(1),
      matchesDuJour: [],
      creneauxDuJour: [creneau],
      activites: CATALOGUE,
      delaiMinActivite: null,
    });

    expect(assignations[0].creneauId).toBe(42);
    expect(assignations[0].activiteId).toBe(REPAS_ID);
    expect(assignations[0].activiteLabel).toBe('Repas');
  });

  it("n'assigne pas plus de candidats que de créneaux disponibles (aucune génération de secours, cf. spec §4)", () => {
    const candidats = candidatsDe(3);
    const creneaux = [makeCreneauActivite({ id: 1, activiteId: REPAS_ID })];

    const { assignations } = service.placerActivitesJour({
      candidats,
      matchesDuJour: [],
      creneauxDuJour: creneaux,
      activites: CATALOGUE,
      delaiMinActivite: null,
    });

    expect(assignations).toHaveLength(1);
  });

  it('inclut les équipes fictives au même titre que les équipes réelles (aperçu Gantt complet)', () => {
    const candidats = [
      { ref: 'real:1', nom: 'Équipe 1' },
      { ref: 'fictive:1', nom: 'Équipe fictive' },
    ];
    const creneaux = [0, 1].map((i) =>
      makeCreneauActivite({
        id: i + 1,
        activiteId: REPAS_ID,
        heureDebut: new Date(JOUR.getTime() + 12 * 3_600_000 + i * 60_000),
      }),
    );

    const { assignations } = service.placerActivitesJour({
      candidats,
      matchesDuJour: [],
      creneauxDuJour: creneaux,
      activites: CATALOGUE,
      delaiMinActivite: null,
    });

    expect(assignations.some((a) => a.equipeRef === 'fictive:1')).toBe(true);
  });

  it('renseigne equipeNom sur chaque assignation à partir du nom du candidat (non-régression)', () => {
    const candidats = candidatsDe(2);
    const creneaux = [0, 1].map((i) =>
      makeCreneauActivite({
        id: i + 1,
        activiteId: REPAS_ID,
        heureDebut: new Date(JOUR.getTime() + 12 * 3_600_000 + i * 60_000),
      }),
    );

    const { assignations } = service.placerActivitesJour({
      candidats,
      matchesDuJour: [],
      creneauxDuJour: creneaux,
      activites: CATALOGUE,
      delaiMinActivite: null,
    });

    for (const a of assignations) {
      const candidat = candidats.find((c) => c.ref === a.equipeRef)!;
      expect(a.equipeNom).toBe(candidat.nom);
    }
  });

  it('renvoie un score numérique cohérent (penalty et slack ≥ 0)', () => {
    const candidats = candidatsDe(6);
    const creneaux = Array.from({ length: 6 }, (_, i) =>
      makeCreneauActivite({
        id: i + 1,
        activiteId: REPAS_ID,
        heureDebut: new Date(JOUR.getTime() + 12 * 3_600_000 + i * 5 * 60_000),
      }),
    );

    const { score } = service.placerActivitesJour({
      candidats,
      matchesDuJour: [],
      creneauxDuJour: creneaux,
      activites: CATALOGUE,
      delaiMinActivite: null,
    });

    expect(score.penalty).toBeGreaterThanOrEqual(0);
    expect(score.slack).toBeGreaterThanOrEqual(0);
  });

  it('préfère, pour un créneau donné, le candidat dont le match du jour ne chevauche pas ce créneau', () => {
    const candidats = [
      { ref: 'real:1', nom: 'Équipe 1' },
      { ref: 'real:2', nom: 'Équipe 2' },
    ];
    // Le match de l'équipe 1 (10:30-10:57) chevauche le seul créneau
    // disponible (10:40-11:20) : le moteur doit préférer l'équipe 2.
    const matchesDuJour = [
      makeMatchGenere({
        equipe1Ref: 'real:1',
        equipe2Ref: 'placeholder:autre',
        dateHeure: new Date('2026-05-23T10:30:00.000Z'),
        dureeMin: 27,
      }),
    ];
    const creneau = makeCreneauActivite({
      id: 1,
      activiteId: REPAS_ID,
      heureDebut: new Date('2026-05-23T10:40:00.000Z'),
      dureeMin: 40,
    });

    const { assignations } = service.placerActivitesJour({
      candidats,
      matchesDuJour,
      creneauxDuJour: [creneau],
      activites: CATALOGUE,
      delaiMinActivite: null,
    });

    expect(assignations).toHaveLength(1);
    expect(assignations[0].equipeRef).toBe('real:2');
  });

  it("tient compte d'une activité du catalogue déjà assignée plus tôt le même jour pour éviter un chevauchement avec une autre activité", () => {
    const candidats = [
      { ref: 'real:1', nom: 'Équipe 1' },
      { ref: 'real:2', nom: 'Équipe 2' },
    ];
    // Un seul créneau Challenge (09:00-09:40, traité en premier car plus
    // tôt) : l'équipe 1 le remporte (ordre d'arrivée, aucune activité
    // préalable pour aucune des deux). Le seul créneau Repas disponible
    // (09:20-10:00) chevauche ce Challenge : le moteur doit alors préférer
        // l'équipe 2, non concernée par le Challenge.
    const creneaux = [
      makeCreneauActivite({
        id: 1,
        activiteId: CHALLENGE_ID,
        heureDebut: new Date('2026-05-23T09:00:00.000Z'),
        dureeMin: 40,
      }),
      makeCreneauActivite({
        id: 2,
        activiteId: REPAS_ID,
        heureDebut: new Date('2026-05-23T09:20:00.000Z'),
        dureeMin: 40,
      }),
    ];

    const { assignations } = service.placerActivitesJour({
      candidats,
      matchesDuJour: [],
      creneauxDuJour: creneaux,
      activites: CATALOGUE,
      delaiMinActivite: null,
    });

    const challenge = assignations.find((a) => a.activiteId === CHALLENGE_ID)!;
    const repas = assignations.find((a) => a.activiteId === REPAS_ID)!;
    expect(challenge.equipeRef).toBe('real:1');
    expect(repas.equipeRef).toBe('real:2');
  });
});
