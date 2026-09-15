-- Migration: planning_match_slot
-- Created: 2026-09-06
-- Feature: Résolution automatique des placeholders de planning live
--
-- Raw SQL, idempotent (cf. décision 1788501923813 : l'outillage `prisma migrate
-- dev/deploy` est inutilisable sur ce projet — migration_lock.toml déclare
-- sqlite, aucune base n'a de table _prisma_migrations).

-- Persiste la règle de résolution de chaque placeholder de planning (poule-*
-- ou vainqueur-*) non résolu au moment de la confirmation, pour permettre une
-- résolution automatique ultérieure une fois le classement/résultat connu.
CREATE TABLE IF NOT EXISTS `planning_match_slots` (
  `id`                   INTEGER      NOT NULL AUTO_INCREMENT,
  `edition_id`           INTEGER      NOT NULL,
  `num_match`            INTEGER      NOT NULL,
  `cote`                 INTEGER      NOT NULL,
  `ref`                  VARCHAR(80)  NOT NULL,
  `libelle_placeholder`  VARCHAR(100) NOT NULL,
  `num_match_source`     INTEGER      NULL,
  `poule_code`           VARCHAR(4)   NULL,
  `rang_poule`           INTEGER      NULL,
  `resolu`               TINYINT(1)   NOT NULL DEFAULT 0,
  `equipe_id_resolu`     INTEGER      NULL,
  `equipe_nom_resolu`    VARCHAR(100) NULL,
  `resolu_at`            DATETIME(3)  NULL,
  `resolu_manuellement`  TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `planning_match_slots_num_match_cote_key` (`num_match`, `cote`),
  CONSTRAINT `planning_match_slots_edition_id_fkey`
    FOREIGN KEY (`edition_id`) REFERENCES `insc_editions`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
