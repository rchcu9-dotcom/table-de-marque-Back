import { RequestMethod, type Type } from '@nestjs/common';
import {
  CUSTOM_ROUTE_ARGS_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  hasConflictingAccess,
  readAccessMetadata,
  resolveAccess,
  type AccessMetadata,
} from '@/auth/access-policy';

export interface RouteInventoryEntry {
  route: string; // 'GET /matches/:id'
  controller: string;
  handler: string;
  metadata: AccessMetadata;
  usesCurrentUser: boolean;
}

export interface ReglesInventaire {
  publicRoutes: readonly string[];
  /** Routes non-GET autorisées à être publiques. */
  publicWrites: readonly string[];
}

interface ModuleDynamique {
  module: object;
  imports?: unknown[];
  controllers?: Type<unknown>[];
}

interface ModuleDifferee {
  forwardRef: () => unknown;
}

function lireListe<T>(cle: string, cible: object): T[] {
  return (Reflect.getMetadata(cle, cible) as T[] | undefined) ?? [];
}

/**
 * Parcourt `imports` depuis la racine, sans instancier aucun provider. Suit aussi les modules
 * dynamiques (`forRoot`) et les `forwardRef`, qui ne portent pas leurs métadonnées sur la classe.
 */
export function discoverControllers(rootModule: unknown): Type<unknown>[] {
  const vus = new Set<unknown>();
  const controleurs = new Set<Type<unknown>>();

  function visiter(entree: unknown): void {
    if (!entree) return;
    const module = (entree as Partial<ModuleDifferee>).forwardRef
      ? (entree as ModuleDifferee).forwardRef()
      : entree;
    if (vus.has(module)) return;
    vus.add(module);

    const dynamique = module as Partial<ModuleDynamique>;
    const classe = (dynamique.module ?? module) as object;
    [
      ...lireListe<Type<unknown>>(MODULE_METADATA.CONTROLLERS, classe),
      ...(dynamique.controllers ?? []),
    ].forEach((c) => controleurs.add(c));
    [
      ...lireListe<unknown>(MODULE_METADATA.IMPORTS, classe),
      ...(dynamique.imports ?? []),
    ].forEach(visiter);
  }

  visiter(rootModule);
  return [...controleurs];
}

function cheminComplet(prefixe: string, chemin: string): string {
  const assemble = `/${prefixe}/${chemin}`.replace(/\/+/g, '/');
  return assemble.length > 1 ? assemble.replace(/\/$/, '') : assemble;
}

export function listRoutes(
  controllers: Type<unknown>[],
): RouteInventoryEntry[] {
  const reflector = new Reflector();

  return controllers.flatMap((controleur) => {
    const prefixes = [
      Reflect.getMetadata(PATH_METADATA, controleur) as
        | string
        | string[]
        | undefined,
    ].flat();
    const prototype = controleur.prototype as Record<string, unknown>;

    return Object.getOwnPropertyNames(prototype).flatMap((handler) => {
      const methode = prototype[handler];
      if (handler === 'constructor' || typeof methode !== 'function') return [];
      const chemins = Reflect.getMetadata(PATH_METADATA, methode) as
        | string
        | string[]
        | undefined;
      if (chemins === undefined) return [];

      const verbe =
        RequestMethod[
          Reflect.getMetadata(METHOD_METADATA, methode) as RequestMethod
        ];
      const parametres =
        (Reflect.getMetadata(ROUTE_ARGS_METADATA, controleur, handler) as
          | object
          | undefined) ?? {};

      return prefixes.flatMap((prefixe) =>
        [chemins].flat().map((chemin) => ({
          route: `${verbe} ${cheminComplet(prefixe ?? '', chemin)}`,
          controller: controleur.name,
          handler,
          metadata: readAccessMetadata(reflector, [methode, controleur]),
          // CurrentUser est le seul décorateur de paramètre personnalisé du back.
          usesCurrentUser: Object.keys(parametres).some((cle) =>
            cle.includes(CUSTOM_ROUTE_ARGS_METADATA),
          ),
        })),
      );
    });
  });
}

/** Une anomalie par ligne, avec le contrôleur et la méthode fautifs. */
export function controlerInventaire(
  routes: RouteInventoryEntry[],
  { publicRoutes, publicWrites }: ReglesInventaire,
): string[] {
  const estPublique = (r: RouteInventoryEntry) =>
    resolveAccess(r.metadata) === 'public';
  const lieu = (r: RouteInventoryEntry) =>
    `${r.route} (${r.controller}.${r.handler})`;
  const publiques = routes.filter(estPublique);
  const nomsPublics = new Set(publiques.map((r) => r.route));

  return [
    ...publiques
      .filter((r) => !publicRoutes.includes(r.route))
      .map((r) => `Route publique hors PUBLIC_ROUTES : ${lieu(r)}`),
    ...publicRoutes
      .filter((route) => !nomsPublics.has(route))
      .map((route) => `PUBLIC_ROUTES périmée : ${route}`),
    ...publiques
      .filter(
        (r) => !r.route.startsWith('GET ') && !publicWrites.includes(r.route),
      )
      .map((r) => `Écriture publique non autorisée : ${lieu(r)}`),
    ...routes
      .filter((r) => hasConflictingAccess(r.metadata))
      .map((r) => `@Public() combiné à une protection : ${lieu(r)}`),
    ...publiques
      .filter((r) => r.usesCurrentUser)
      .map((r) => `@CurrentUser() sur une route publique : ${lieu(r)}`),
  ];
}
