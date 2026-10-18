import { ConflictException } from '@nestjs/common';
import type { EditionVerrouService } from '../../src/inscription/application/shared/edition-verrou.service';

/**
 * Double de EditionVerrouService pour les specs des use cases gardés : par
 * défaut l'étape autorise l'écriture ; `verrouRefuse` simule une étape figée.
 */
export function verrouAutorise(): jest.Mocked<
  Pick<
    EditionVerrouService,
    'assertParametresInscriptionModifiables' | 'assertFormuleSportiveModifiable'
  >
> {
  return {
    assertParametresInscriptionModifiables: jest.fn().mockResolvedValue(undefined),
    assertFormuleSportiveModifiable: jest.fn().mockResolvedValue(undefined),
  };
}

export function verrouRefuse(message = 'figé'): ReturnType<typeof verrouAutorise> {
  return {
    assertParametresInscriptionModifiables: jest
      .fn()
      .mockRejectedValue(new ConflictException(message)),
    assertFormuleSportiveModifiable: jest
      .fn()
      .mockRejectedValue(new ConflictException(message)),
  };
}

/**
 * Dépendance espionne : tout appel de méthode, à n'importe quelle profondeur
 * (`repo.x()`, `prisma.inscEdition.update()`), est enregistré dans `appels`.
 * Sert à prouver qu'un use case refusé par le garde n'a rien lu ni écrit.
 */
export function dependanceEspionne(): { dep: any; appels: string[] } {
  const appels: string[] = [];
  const noeud = (chemin: string): any =>
    new Proxy(function () {}, {
      get: (_cible, prop) =>
        prop === 'then' ? undefined : noeud(`${chemin}.${String(prop)}`),
      apply: () => {
        appels.push(chemin);
        return undefined;
      },
    });
  return { dep: noeud('dep'), appels };
}
