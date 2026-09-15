-- Migration: table_de_marque_match_live
-- Created: 2026-09-04
-- Feature: Table de marque — match live
--
-- NOTE: ta_equipes is a legacy table reloaded by an external process.
-- The FK to insc_equipes_referentiel is omitted from the ALTER TABLE
-- to avoid breakage during re-imports. The integrity is enforced at the
-- application level (usecase) per D1 and the architecture note in
-- docs/specs/-spec-...track.md.

-- D1: lien TaEquipe ↔ InscEquipeReferentiel (colonne uniquement, pas de FK DB)
ALTER TABLE `ta_equipes`
  ADD COLUMN IF NOT EXISTS `EQUIPE_REF_ID` INTEGER NULL;

-- D3: types de pénalité (référentiel)
CREATE TABLE IF NOT EXISTS `match_types_penalite` (
  `code`                   VARCHAR(30)  NOT NULL,
  `libelle`                VARCHAR(100) NOT NULL,
  `duree_minutes_defaut`   INTEGER      NOT NULL,
  `actif`                  TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed: 3 types par défaut (idempotent)
INSERT INTO `match_types_penalite` (`code`, `libelle`, `duree_minutes_defaut`, `actif`)
VALUES
  ('mineure',    'Mineure',    2,  1),
  ('majeure',    'Majeure',    5,  1),
  ('meconduite', 'Méconduite', 10, 1)
ON DUPLICATE KEY UPDATE `libelle` = VALUES(`libelle`);

-- D5: état du match live
CREATE TABLE IF NOT EXISTS `match_live` (
  `num_match`               INTEGER      NOT NULL,
  `etat`                    ENUM('PLANIFIE','ANNONCE','EN_COURS','EN_PAUSE','TERMINE') NOT NULL DEFAULT 'PLANIFIE',
  `temps_ecoule_secondes`   INTEGER      NOT NULL DEFAULT 0,
  `chrono_en_cours`         TINYINT(1)   NOT NULL DEFAULT 0,
  `chrono_derniere_maj_at`  DATETIME(3)  NULL,
  `score1_cache`            INTEGER      NOT NULL DEFAULT 0,
  `score2_cache`            INTEGER      NOT NULL DEFAULT 0,
  `created_at`              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`num_match`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Buts (append-only)
CREATE TABLE IF NOT EXISTS `match_buts` (
  `id`                 INTEGER      NOT NULL AUTO_INCREMENT,
  `num_match`          INTEGER      NOT NULL,
  `equipe_id`          INTEGER      NOT NULL,
  `buteur_id`          INTEGER      NOT NULL,
  `assist1_id`         INTEGER      NULL,
  `assist2_id`         INTEGER      NULL,
  `temps_jeu_secondes` INTEGER      NOT NULL,
  `created_at`         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `match_buts_num_match_fkey`
    FOREIGN KEY (`num_match`) REFERENCES `match_live`(`num_match`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Pénalités (append-only)
CREATE TABLE IF NOT EXISTS `match_penalites` (
  `id`                 INTEGER      NOT NULL AUTO_INCREMENT,
  `num_match`          INTEGER      NOT NULL,
  `equipe_id`          INTEGER      NOT NULL,
  `joueur_id`          INTEGER      NOT NULL,
  `type_penalite_code` VARCHAR(30)  NOT NULL,
  `duree_minutes`      INTEGER      NOT NULL,
  `temps_jeu_debut`    INTEGER      NOT NULL,
  `created_at`         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `match_penalites_num_match_fkey`
    FOREIGN KEY (`num_match`) REFERENCES `match_live`(`num_match`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `match_penalites_type_penalite_code_fkey`
    FOREIGN KEY (`type_penalite_code`) REFERENCES `match_types_penalite`(`code`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
