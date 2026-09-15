import { GetEditionEnPreparationUseCase } from './get-edition-en-preparation.usecase';
import type { EditionResolverService } from '../shared/edition-resolver.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRawEdition(overrides: { id?: number; etape?: string } = {}) {
  return {
    id: overrides.id ?? 1,
    nom: 'RCHC U11 2027',
    categorie: 'U11',
    annee: 2027,
    etape: overrides.etape ?? 'CREATION_NOUVEAU_TOURNOI',
    dateDebut: new Date('2027-01-01'),
    dateFinDebut: new Date('2027-01-01'),
    dateFinFin: new Date('2027-01-01'),
    fraisInscription: 0,
    prixRepas: 0,
    nbPlacesMax: 16,
    imageUrl: null,
    imageDossierUrl: null,
    imageRibUrl: null,
    contactEmail: null,
    contactPhone: null,
    dureeSurfacageMin: 20,
    dureeMatchPouleMin: 27,
    dureeMatchFinalMin: 33,
    affichagePlanningPublic: false,
    msgBienvenue: null,
    msgFaisonsConnaissance: null,
    msgSelectionEquipe: null,
    msgAjoutEquipe: null,
    msgInscriptionEnCours: null,
    msgInscriptionValidee: null,
    msgLancerDemande: null,
    msgDemandeSoumise: null,
    msgListeAttente: null,
    msgPaiementAttendu: null,
    msgChequeInfo1: null,
    msgChequeInfo2: null,
    msgInscriptionConfirmee: null,
    msgRenseigneJoueurs: null,
    anneesAge: [],
    createdAt: new Date('2027-01-01'),
    updatedAt: new Date('2027-01-01'),
  };
}

function makeResolver(getEditionEnPreparation: jest.Mock) {
  return { getEditionEnPreparation } as unknown as EditionResolverService;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('GetEditionEnPreparationUseCase', () => {
  it('retourne null (sans exception) quand aucune édition en préparation n\'existe', async () => {
    const useCase = new GetEditionEnPreparationUseCase(
      makeResolver(jest.fn().mockResolvedValue(null)),
    );

    const result = await useCase.execute();

    expect(result).toBeNull();
  });

  it('retourne l\'édition en préparation mappée en entité de domaine', async () => {
    const rawEdition = makeRawEdition({ id: 7 });
    const useCase = new GetEditionEnPreparationUseCase(
      makeResolver(jest.fn().mockResolvedValue(rawEdition)),
    );

    const result = await useCase.execute();

    expect(result).not.toBeNull();
    expect(result?.id).toBe(7);
    expect(result?.etape).toBe('CREATION_NOUVEAU_TOURNOI');
  });
});
