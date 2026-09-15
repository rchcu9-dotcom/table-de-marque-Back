import { BadRequestException } from '@nestjs/common';
import { MatchLiveEtatService } from './match-live-etat.service';
import { MatchLiveEtat } from '../../domain/enums/match-live-etat.enum';

describe('MatchLiveEtatService', () => {
  let service: MatchLiveEtatService;

  beforeEach(() => {
    service = new MatchLiveEtatService();
  });

  describe('transitions valides', () => {
    it('retourne ANNONCE depuis PLANIFIE via annoncer', () => {
      expect(service.transition(MatchLiveEtat.PLANIFIE, 'annoncer')).toBe(
        MatchLiveEtat.ANNONCE,
      );
    });

    it('retourne EN_COURS depuis ANNONCE via demarrer', () => {
      expect(service.transition(MatchLiveEtat.ANNONCE, 'demarrer')).toBe(
        MatchLiveEtat.EN_COURS,
      );
    });

    it('retourne EN_COURS depuis EN_PAUSE via demarrer (reprise)', () => {
      expect(service.transition(MatchLiveEtat.EN_PAUSE, 'demarrer')).toBe(
        MatchLiveEtat.EN_COURS,
      );
    });

    it('retourne EN_PAUSE depuis EN_COURS via pauser', () => {
      expect(service.transition(MatchLiveEtat.EN_COURS, 'pauser')).toBe(
        MatchLiveEtat.EN_PAUSE,
      );
    });

    it('retourne TERMINE depuis EN_PAUSE via terminer', () => {
      expect(service.transition(MatchLiveEtat.EN_PAUSE, 'terminer')).toBe(
        MatchLiveEtat.TERMINE,
      );
    });
  });

  describe('transitions invalides — annoncer', () => {
    it('lève BadRequestException si annoncer depuis ANNONCE', () => {
      expect(() => service.transition(MatchLiveEtat.ANNONCE, 'annoncer')).toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException si annoncer depuis EN_COURS', () => {
      expect(() => service.transition(MatchLiveEtat.EN_COURS, 'annoncer')).toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException si annoncer depuis EN_PAUSE', () => {
      expect(() => service.transition(MatchLiveEtat.EN_PAUSE, 'annoncer')).toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException si annoncer depuis TERMINE (D4 — pas de réouverture)', () => {
      expect(() => service.transition(MatchLiveEtat.TERMINE, 'annoncer')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('transitions invalides — demarrer', () => {
    it('lève BadRequestException si demarrer depuis PLANIFIE', () => {
      expect(() => service.transition(MatchLiveEtat.PLANIFIE, 'demarrer')).toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException si demarrer depuis TERMINE', () => {
      expect(() => service.transition(MatchLiveEtat.TERMINE, 'demarrer')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('transitions invalides — pauser', () => {
    it('lève BadRequestException si pauser depuis PLANIFIE', () => {
      expect(() => service.transition(MatchLiveEtat.PLANIFIE, 'pauser')).toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException si pauser depuis ANNONCE', () => {
      expect(() => service.transition(MatchLiveEtat.ANNONCE, 'pauser')).toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException si pauser depuis EN_PAUSE', () => {
      expect(() => service.transition(MatchLiveEtat.EN_PAUSE, 'pauser')).toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException si pauser depuis TERMINE', () => {
      expect(() => service.transition(MatchLiveEtat.TERMINE, 'pauser')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('transitions invalides — terminer', () => {
    it('lève BadRequestException si terminer depuis PLANIFIE', () => {
      expect(() => service.transition(MatchLiveEtat.PLANIFIE, 'terminer')).toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException si terminer depuis ANNONCE', () => {
      expect(() => service.transition(MatchLiveEtat.ANNONCE, 'terminer')).toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException si terminer depuis EN_COURS', () => {
      expect(() => service.transition(MatchLiveEtat.EN_COURS, 'terminer')).toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException si terminer depuis TERMINE (D4 — match terminé non réouvrable)', () => {
      expect(() => service.transition(MatchLiveEtat.TERMINE, 'terminer')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('message d\'erreur', () => {
    it('inclut l\'action et l\'état courant dans le message', () => {
      expect(() =>
        service.transition(MatchLiveEtat.PLANIFIE, 'demarrer'),
      ).toThrow("Transition 'demarrer' impossible depuis l'état 'PLANIFIE'");
    });
  });
});
