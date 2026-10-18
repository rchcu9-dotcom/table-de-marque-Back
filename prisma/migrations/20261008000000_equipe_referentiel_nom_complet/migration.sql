-- Migration: equipe_referentiel_nom_complet
-- Created: 2026-10-08
-- Feature: ajout du champ InscEquipeReferentiel.nomComplet (nom officiel long,
-- facultatif). `nom` reste le nom court, unique, seule source du nom de fichier
-- de logo
-- (cf. docs/specs/-prise-en-compte-du-nom-court-pour-les-logos-contexte-actuel.md).
--
-- Raw SQL, appliquée à la main (cf. décision 1788501923813 : `prisma migrate
-- dev/deploy` inutilisable sur ce projet). Additive et idempotente (IF NOT
-- EXISTS, MariaDB 10.5+) — aucune donnée existante modifiée.
--
-- AVANT de l'appliquer sur une base où l'index unique n'existe pas encore,
-- contrôler les doublons ; si la requête renvoie des lignes, la création de
-- l'index échoue et les doublons se règlent à la main (une inscription peut
-- référencer chacune des lignes) :
--
--   SELECT nom, COUNT(*) FROM insc_equipes_referentiel GROUP BY nom HAVING COUNT(*) > 1;
--
-- À appliquer AVANT de déployer le back : le client Prisma régénéré lit
-- `nom_complet`, toute lecture du référentiel échoue si la colonne manque.

ALTER TABLE `insc_equipes_referentiel`
  ADD COLUMN IF NOT EXISTS `nom_complet` VARCHAR(150) NULL AFTER `nom`;

-- Même nom que celui attendu par Prisma (`nom @unique`) : sans effet là où
-- l'index existe déjà.
CREATE UNIQUE INDEX IF NOT EXISTS `insc_equipes_referentiel_nom_key`
  ON `insc_equipes_referentiel` (`nom`);
