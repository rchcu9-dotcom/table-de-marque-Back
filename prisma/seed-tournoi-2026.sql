-- =============================================================================
-- Seed base test - Tournoi RCHC 2026
-- Source de verite : outputs JSON des planners J1, J2, J3
--   J1 planning : .codex/planning-j1/output/planning-j1-2026-03-07.json
--   J2 planning : .codex/planning-j2/output/planning-j2-2026-05-24.json
--   J3 planning : .codex/planning-j3/output/planning-j3-2026-05-25.json
--
-- J1 = 23/05/2026 (samedi)   - 24 matchs 5v5, challenge, repas
-- J2 = 24/05/2026 (dimanche) - 24 matchs 5v5 + 16 matchs 3v3, repas
-- J3 = 25/05/2026 (lundi)    - 8 Phase1 5v5 + 8 Phase2 5v5, repas Phase2
--
-- NUM_MATCH  >  100 -> 3v3  (regle hardcodee dans le repository)
-- NUM_MATCH <=  100 -> 5v5
-- SURFACAGE  =    0 -> match reel
--
-- Groupes J1 : A={Meyrin,Champigny,Dammarie,Angers}
--              B={Rennes,Meudon,Compiegne,Neuilly}
--              C={Cholet,Le Havre,Evry-Viry,Courbevoie}
--              D={Tours,Valenciennes,Rouen,Les Volants}
-- Groupes J2 : E / F / G / H
--   E = Or E        : E1 E2 E3 E4
--   F = Or F        : F1 F2 F3 F4
--   G = Argent G    : G1 G2 G3 G4
--   H = Argent H    : H1 H2 H3 H4
-- Groupes J3 : I / J / K / L
--   I = Carre Or 1-4
--   J = Carre Or 5-8
--   K = Carre Argent 9-12
--   L = Carre Argent 13-16
-- =============================================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";
/*!40101 SET NAMES utf8mb4 */;

USE `rchcu11_tournoi_test`;

-- Nettoyage
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `TA_MATCHS`;
TRUNCATE TABLE `ta_equipes`;
TRUNCATE TABLE `ta_classement`;
TRUNCATE TABLE `ta_joueurs`;
TRUNCATE TABLE `ta_configuration`;
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- ta_configuration
-- =============================================================================
INSERT INTO `ta_configuration`
  (`id`,`nb_avant`,`nb_samedi`,`nb_dimanche`,`nb_apres`,
   `tir_dehors`,`tir_dedans`,`tir_haut`,`tir_bas`,
   `libelle_dehors`,`libelle_dedant`,`libelle_basse`,`libelle_haute`,
   `penalite_porte`,`libelle_porte`,`libelle_arret_seconde`,`arret_seconde`)
VALUES
  (1, 0, 0, 0, 0,
   1, 0, -5, -2,
   'Dehors (+1)', 'Dedans', 'Basse (-2)', 'Haute (-5)',
   3, 'Porte (+3)', '(5 secondes en plus par but encaisse)', 5);

-- =============================================================================
-- ta_equipes - 16 equipes J1
-- =============================================================================
INSERT INTO `ta_equipes`
  (`ID`,`EQUIPE`,`REPAS_SAMEDI`,`CHALLENGE_SAMEDI`,`REPAS_DIMANCHE`,
   `IMAGE`,`COULEUR_FONT`,`COULEUR_BACK`,
   `COACH_1`,`COACH_2`,`COACH_3`,`COACH_4`)
VALUES
(1,  'Meyrin',      '2026-05-23 11:05:00','2026-05-23 19:00:00', NULL, 'meyrin.png',      '000000','feb71f', '','','',''),
(2,  'Champigny',   '2026-05-23 12:35:00','2026-05-23 18:20:00', NULL, 'champigny.png',   'ffffff','427ab1', '','','',''),
(3,  'Dammarie',    '2026-05-23 11:50:00','2026-05-23 15:00:00', NULL, 'dammarie.png',    'ffffff','ca8924', '','','',''),
(4,  'Angers',      '2026-05-23 12:40:00','2026-05-23 11:00:00', NULL, 'angers.png',      'ffffff','006633', '','','',''),
(5,  'Rennes',      '2026-05-23 11:15:00','2026-05-23 14:20:00', NULL, 'rennes.png',      '000000','49a53f', '','','',''),
(6,  'Meudon',      '2026-05-23 13:15:00','2026-05-23 09:40:00', NULL, 'meudon.png',      'fcc72e','8e2e33', '','','',''),
(7,  'Compiegne',   '2026-05-23 12:00:00','2026-05-23 16:20:00', NULL, 'compiegne.png',   'ffffff','003087', '','','',''),
(8,  'Neuilly',     '2026-05-23 11:10:00','2026-05-23 13:00:00', NULL, 'neuilly.png',     'e2001a','180101', '','','',''),
(9,  'Cholet',      '2026-05-23 11:45:00','2026-05-23 15:40:00', NULL, 'cholet.png',      'ffffff','e3131b', '','','',''),
(10, 'Le Havre',    '2026-05-23 13:20:00','2026-05-23 09:00:00', NULL, 'lehavre.png',     'ffffff','51aad6', '','','',''),
(11, 'Evry-Viry',   '2026-05-23 12:45:00','2026-05-23 17:00:00', NULL, 'evryviry.png',    'ffff00','0c1e3b', '','','',''),
(12, 'Courbevoie',  '2026-05-23 13:25:00','2026-05-23 12:20:00', NULL, 'courbevoie.png',  'ffffff','d9221c', '','','',''),
(13, 'Tours',       '2026-05-23 12:30:00','2026-05-23 11:40:00', NULL, 'tours.png',       '000000','ff6600', '','','',''),
(14, 'Valenciennes','2026-05-23 13:30:00','2026-05-23 10:20:00', NULL, 'valenciennes.png','ffffff','003399', '','','',''),
(15, 'Rouen',       '2026-05-23 11:00:00','2026-05-23 17:40:00', NULL, 'rouen.png',       'ffffff','d10a11', '','','',''),
(16, 'Les Volants', '2026-05-23 11:55:00','2026-05-23 13:40:00', NULL, 'lesvolants.png',  'ffffff','000000', '','','','');

-- =============================================================================
-- ta_joueurs - vierge
-- =============================================================================
-- (table tronquee ci-dessus, aucun INSERT)

-- =============================================================================
-- ta_classement - init debut de tournoi
-- J1 : vraies equipes
-- J2 : groupes E/F/G/H persists, alias E1..H4
-- J3 : structure I/J/K/L deja presente, sans equipe finale resolue
-- =============================================================================
INSERT INTO `ta_classement`
  (`GROUPE_NOM`,`ORDRE`,`ORDRE_FINAL`,`EQUIPE`,`EQUIPE_ID`,
   `J`,`V`,`N`,`D`,`PTS`,`BP`,`BC`,`DIFF`,
   `REPAS_SAMEDI`,`CHALLENGE_SAMEDI`)
VALUES
('A', 1,  1, 'Meyrin',      1,  0,0,0,0,0,0,0,0, '2026-05-23 11:05:00','2026-05-23 19:00:00'),
('A', 2,  5, 'Champigny',   2,  0,0,0,0,0,0,0,0, '2026-05-23 12:35:00','2026-05-23 18:20:00'),
('A', 3,  9, 'Dammarie',    3,  0,0,0,0,0,0,0,0, '2026-05-23 11:50:00','2026-05-23 15:00:00'),
('A', 4, 13, 'Angers',      4,  0,0,0,0,0,0,0,0, '2026-05-23 12:40:00','2026-05-23 11:00:00'),
('B', 1,  2, 'Rennes',      5,  0,0,0,0,0,0,0,0, '2026-05-23 11:15:00','2026-05-23 14:20:00'),
('B', 2,  6, 'Meudon',      6,  0,0,0,0,0,0,0,0, '2026-05-23 13:15:00','2026-05-23 09:40:00'),
('B', 3, 10, 'Compiegne',   7,  0,0,0,0,0,0,0,0, '2026-05-23 12:00:00','2026-05-23 16:20:00'),
('B', 4, 14, 'Neuilly',     8,  0,0,0,0,0,0,0,0, '2026-05-23 11:10:00','2026-05-23 13:00:00'),
('C', 1,  3, 'Cholet',      9,  0,0,0,0,0,0,0,0, '2026-05-23 11:45:00','2026-05-23 15:40:00'),
('C', 2,  7, 'Le Havre',    10, 0,0,0,0,0,0,0,0, '2026-05-23 13:20:00','2026-05-23 09:00:00'),
('C', 3, 11, 'Evry-Viry',   11, 0,0,0,0,0,0,0,0, '2026-05-23 12:45:00','2026-05-23 17:00:00'),
('C', 4, 15, 'Courbevoie',  12, 0,0,0,0,0,0,0,0, '2026-05-23 13:25:00','2026-05-23 12:20:00'),
('D', 1,  4, 'Tours',       13, 0,0,0,0,0,0,0,0, '2026-05-23 12:30:00','2026-05-23 11:40:00'),
('D', 2,  8, 'Valenciennes',14, 0,0,0,0,0,0,0,0, '2026-05-23 13:30:00','2026-05-23 10:20:00'),
('D', 3, 12, 'Rouen',       15, 0,0,0,0,0,0,0,0, '2026-05-23 11:00:00','2026-05-23 17:40:00'),
('D', 4, 16, 'Les Volants', 16, 0,0,0,0,0,0,0,0, '2026-05-23 11:55:00','2026-05-23 13:40:00'),

('E', 1, 1, 'E1', 101, 0,0,0,0,0,0,0,0, '2026-05-24 11:05:00',NULL),
('E', 2, 2, 'E2', 102, 0,0,0,0,0,0,0,0, '2026-05-24 12:45:00',NULL),
('E', 3, 3, 'E3', 103, 0,0,0,0,0,0,0,0, '2026-05-24 11:15:00',NULL),
('E', 4, 4, 'E4', 104, 0,0,0,0,0,0,0,0, '2026-05-24 13:25:00',NULL),
('F', 1, 1, 'F1', 105, 0,0,0,0,0,0,0,0, '2026-05-24 11:50:00',NULL),
('F', 2, 2, 'F2', 106, 0,0,0,0,0,0,0,0, '2026-05-24 12:40:00',NULL),
('F', 3, 3, 'F3', 107, 0,0,0,0,0,0,0,0, '2026-05-24 12:35:00',NULL),
('F', 4, 4, 'F4', 108, 0,0,0,0,0,0,0,0, '2026-05-24 11:45:00',NULL),
('G', 1, 1, 'G1', 109, 0,0,0,0,0,0,0,0, '2026-05-24 11:10:00',NULL),
('G', 2, 2, 'G2', 110, 0,0,0,0,0,0,0,0, '2026-05-24 12:30:00',NULL),
('G', 3, 3, 'G3', 111, 0,0,0,0,0,0,0,0, '2026-05-24 11:55:00',NULL),
('G', 4, 4, 'G4', 112, 0,0,0,0,0,0,0,0, '2026-05-24 13:20:00',NULL),
('H', 1, 1, 'H1', 113, 0,0,0,0,0,0,0,0, '2026-05-24 12:00:00',NULL),
('H', 2, 2, 'H2', 114, 0,0,0,0,0,0,0,0, '2026-05-24 13:15:00',NULL),
('H', 3, 3, 'H3', 115, 0,0,0,0,0,0,0,0, '2026-05-24 13:30:00',NULL),
('H', 4, 4, 'H4', 116, 0,0,0,0,0,0,0,0, '2026-05-24 11:00:00',NULL),

('I', 1, 1, 'En attente du resultat', 201, 0,0,0,0,0,0,0,0, NULL,NULL),
('I', 2, 2, 'En attente du resultat', 202, 0,0,0,0,0,0,0,0, NULL,NULL),
('I', 3, 3, 'En attente du resultat', 203, 0,0,0,0,0,0,0,0, NULL,NULL),
('I', 4, 4, 'En attente du resultat', 204, 0,0,0,0,0,0,0,0, NULL,NULL),
('J', 1, 1, 'En attente du resultat', 205, 0,0,0,0,0,0,0,0, NULL,NULL),
('J', 2, 2, 'En attente du resultat', 206, 0,0,0,0,0,0,0,0, NULL,NULL),
('J', 3, 3, 'En attente du resultat', 207, 0,0,0,0,0,0,0,0, NULL,NULL),
('J', 4, 4, 'En attente du resultat', 208, 0,0,0,0,0,0,0,0, NULL,NULL),
('K', 1, 1, 'En attente du resultat', 209, 0,0,0,0,0,0,0,0, NULL,NULL),
('K', 2, 2, 'En attente du resultat', 210, 0,0,0,0,0,0,0,0, NULL,NULL),
('K', 3, 3, 'En attente du resultat', 211, 0,0,0,0,0,0,0,0, NULL,NULL),
('K', 4, 4, 'En attente du resultat', 212, 0,0,0,0,0,0,0,0, NULL,NULL),
('L', 1, 1, 'En attente du resultat', 213, 0,0,0,0,0,0,0,0, NULL,NULL),
('L', 2, 2, 'En attente du resultat', 214, 0,0,0,0,0,0,0,0, NULL,NULL),
('L', 3, 3, 'En attente du resultat', 215, 0,0,0,0,0,0,0,0, NULL,NULL),
('L', 4, 4, 'En attente du resultat', 216, 0,0,0,0,0,0,0,0, NULL,NULL);

-- =============================================================================
-- TA_MATCHS - J1 5v5 (NUM 1-24, date 2026-05-23)
-- =============================================================================
INSERT INTO `TA_MATCHS`
  (`NUM_MATCH`,`MATCH_CASE`,`EQUIPE1`,`EQUIPE2`,`EQUIPE_ID1`,`EQUIPE_ID2`,
   `SCORE1`,`SCORE2`,`ETAT`,`DATEHEURE`,`SURFACAGE`,`ECART`,`NB_PHOTOS`)
VALUES
(  1, 1, 'Meyrin',      'Angers',       1,  4,  NULL,NULL,'','2026-05-23 09:00:00', 0,'',0),
(  2, 1, 'Rennes',      'Neuilly',      5,  8,  NULL,NULL,'','2026-05-23 09:27:00', 0,'',0),
(  3, 1, 'Cholet',      'Courbevoie',   9,  12, NULL,NULL,'','2026-05-23 09:54:00', 0,'',0),
(  4, 1, 'Tours',       'Les Volants',  13, 16, NULL,NULL,'','2026-05-23 10:21:00', 0,'',0),
(  5, 1, 'Champigny',   'Dammarie',     2,  3,  NULL,NULL,'','2026-05-23 11:08:00', 0,'',0),
(  6, 1, 'Meudon',      'Compiegne',    6,  7,  NULL,NULL,'','2026-05-23 11:35:00', 0,'',0),
(  7, 1, 'Le Havre',    'Evry-Viry',    10, 11, NULL,NULL,'','2026-05-23 12:02:00', 0,'',0),
(  8, 1, 'Valenciennes','Rouen',        14, 15, NULL,NULL,'','2026-05-23 12:29:00', 0,'',0),
(  9, 1, 'Meyrin',      'Dammarie',     1,  3,  NULL,NULL,'','2026-05-23 13:16:00', 0,'',0),
( 10, 1, 'Rennes',      'Compiegne',    5,  7,  NULL,NULL,'','2026-05-23 13:43:00', 0,'',0),
( 11, 1, 'Cholet',      'Evry-Viry',    9,  11, NULL,NULL,'','2026-05-23 14:10:00', 0,'',0),
( 12, 1, 'Tours',       'Rouen',        13, 15, NULL,NULL,'','2026-05-23 14:37:00', 0,'',0),
( 13, 1, 'Champigny',   'Angers',       2,  4,  NULL,NULL,'','2026-05-23 15:24:00', 0,'',0),
( 14, 1, 'Meudon',      'Neuilly',      6,  8,  NULL,NULL,'','2026-05-23 15:51:00', 0,'',0),
( 15, 1, 'Le Havre',    'Courbevoie',   10, 12, NULL,NULL,'','2026-05-23 16:18:00', 0,'',0),
( 16, 1, 'Valenciennes','Les Volants',  14, 16, NULL,NULL,'','2026-05-23 16:45:00', 0,'',0),
( 17, 1, 'Meyrin',      'Champigny',    1,  2,  NULL,NULL,'','2026-05-23 17:32:00', 0,'',0),
( 18, 1, 'Rennes',      'Meudon',       5,  6,  NULL,NULL,'','2026-05-23 17:59:00', 0,'',0),
( 19, 1, 'Cholet',      'Le Havre',     9,  10, NULL,NULL,'','2026-05-23 18:26:00', 0,'',0),
( 20, 1, 'Tours',       'Valenciennes', 13, 14, NULL,NULL,'','2026-05-23 18:53:00', 0,'',0),
( 21, 1, 'Dammarie',    'Angers',       3,  4,  NULL,NULL,'','2026-05-23 19:40:00', 0,'',0),
( 22, 1, 'Compiegne',   'Neuilly',      7,  8,  NULL,NULL,'','2026-05-23 20:07:00', 0,'',0),
( 23, 1, 'Evry-Viry',   'Courbevoie',   11, 12, NULL,NULL,'','2026-05-23 20:34:00', 0,'',0),
( 24, 1, 'Rouen',       'Les Volants',  15, 16, NULL,NULL,'','2026-05-23 21:01:00', 0,'',0),

-- =============================================================================
-- TA_MATCHS - J2 5v5 (NUM 25-48, date 2026-05-24)
-- Pool 1(OA): E1 E2 F1 F2 | Pool 2(OB): G1 G2 H1 H2
-- Pool 3(AC): E3 E4 F3 F4 | Pool 4(AD): G3 G4 H3 H4
-- =============================================================================
( 25, 1, 'E1','E2', NULL,NULL, NULL,NULL,'','2026-05-24 09:00:00', 0,'',0),
( 29, 1, 'F2','F1', NULL,NULL, NULL,NULL,'','2026-05-24 11:08:00', 0,'',0),
( 33, 1, 'E1','F1', NULL,NULL, NULL,NULL,'','2026-05-24 13:16:00', 0,'',0),
( 37, 1, 'E2','F2', NULL,NULL, NULL,NULL,'','2026-05-24 15:24:00', 0,'',0),
( 41, 1, 'E1','F2', NULL,NULL, NULL,NULL,'','2026-05-24 17:32:00', 0,'',0),
( 45, 1, 'E2','F1', NULL,NULL, NULL,NULL,'','2026-05-24 19:40:00', 0,'',0),
( 26, 1, 'G1','G2', NULL,NULL, NULL,NULL,'','2026-05-24 09:27:00', 0,'',0),
( 30, 1, 'H1','H2', NULL,NULL, NULL,NULL,'','2026-05-24 11:35:00', 0,'',0),
( 34, 1, 'H1','G1', NULL,NULL, NULL,NULL,'','2026-05-24 13:43:00', 0,'',0),
( 38, 1, 'G2','H2', NULL,NULL, NULL,NULL,'','2026-05-24 15:51:00', 0,'',0),
( 42, 1, 'G1','H2', NULL,NULL, NULL,NULL,'','2026-05-24 17:59:00', 0,'',0),
( 46, 1, 'G2','H1', NULL,NULL, NULL,NULL,'','2026-05-24 20:07:00', 0,'',0),
( 27, 1, 'E3','F4', NULL,NULL, NULL,NULL,'','2026-05-24 09:54:00', 0,'',0),
( 31, 1, 'E4','F3', NULL,NULL, NULL,NULL,'','2026-05-24 12:02:00', 0,'',0),
( 35, 1, 'E3','F3', NULL,NULL, NULL,NULL,'','2026-05-24 14:10:00', 0,'',0),
( 39, 1, 'E4','F4', NULL,NULL, NULL,NULL,'','2026-05-24 16:18:00', 0,'',0),
( 43, 1, 'E3','E4', NULL,NULL, NULL,NULL,'','2026-05-24 18:26:00', 0,'',0),
( 47, 1, 'F3','F4', NULL,NULL, NULL,NULL,'','2026-05-24 20:34:00', 0,'',0),
( 28, 1, 'G3','G4', NULL,NULL, NULL,NULL,'','2026-05-24 10:21:00', 0,'',0),
( 32, 1, 'H3','H4', NULL,NULL, NULL,NULL,'','2026-05-24 12:29:00', 0,'',0),
( 36, 1, 'G3','H4', NULL,NULL, NULL,NULL,'','2026-05-24 14:37:00', 0,'',0),
( 40, 1, 'G4','H3', NULL,NULL, NULL,NULL,'','2026-05-24 16:45:00', 0,'',0),
( 44, 1, 'G3','H3', NULL,NULL, NULL,NULL,'','2026-05-24 18:53:00', 0,'',0),
( 48, 1, 'G4','H4', NULL,NULL, NULL,NULL,'','2026-05-24 21:01:00', 0,'',0),

-- =============================================================================
-- TA_MATCHS - J3 Phase 1 (NUM 49-56, date 2026-05-25)
-- Placeholders alignes sur le monde J2 E/F/G/H
-- =============================================================================
( 49, 1, 'G3','H4', NULL,NULL, NULL,NULL,'','2026-05-25 08:00:00', 0,'',0),
( 50, 1, 'H3','G4', NULL,NULL, NULL,NULL,'','2026-05-25 08:27:00', 0,'',0),
( 51, 1, 'E3','F4', NULL,NULL, NULL,NULL,'','2026-05-25 08:54:00', 0,'',0),
( 52, 1, 'F3','E4', NULL,NULL, NULL,NULL,'','2026-05-25 09:21:00', 0,'',0),
( 53, 1, 'G1','H2', NULL,NULL, NULL,NULL,'','2026-05-25 10:03:00', 0,'',0),
( 54, 1, 'H1','G2', NULL,NULL, NULL,NULL,'','2026-05-25 10:30:00', 0,'',0),
( 55, 1, 'E1','F2', NULL,NULL, NULL,NULL,'','2026-05-25 10:57:00', 0,'',0),
( 56, 1, 'F1','E2', NULL,NULL, NULL,NULL,'','2026-05-25 11:24:00', 0,'',0),

-- =============================================================================
-- TA_MATCHS - J3 Phase 2 (NUM 57-64, date 2026-05-25)
-- =============================================================================
( 57, 1, 'pE3F4','pF3E4', NULL,NULL, NULL,NULL,'','2026-05-25 12:06:00', 0,'',0),
( 58, 1, 'pG1H2','pH1G2', NULL,NULL, NULL,NULL,'','2026-05-25 12:33:00', 0,'',0),
( 59, 1, 'pG3H4','pH3G4', NULL,NULL, NULL,NULL,'','2026-05-25 13:00:00', 0,'',0),
( 60, 1, 'pE1F2','pF1E2', NULL,NULL, NULL,NULL,'','2026-05-25 13:27:00', 0,'',0),
( 61, 1, 'vG3H4','vH3G4', NULL,NULL, NULL,NULL,'','2026-05-25 14:09:00', 0,'',0),
( 62, 1, 'vE3F4','vF3E4', NULL,NULL, NULL,NULL,'','2026-05-25 14:36:00', 0,'',0),
( 63, 1, 'vG1H2','vH1G2', NULL,NULL, NULL,NULL,'','2026-05-25 15:03:00', 0,'',0),
( 64, 1, 'vE1F2','vF1E2', NULL,NULL, NULL,NULL,'','2026-05-25 15:45:00', 0,'',0),

-- =============================================================================
-- TA_MATCHS - J2 3v3 (NUM 101-116, date 2026-05-24)
-- =============================================================================
(101, 1, 'H2','H3', NULL,NULL, NULL,NULL,'','2026-05-24 09:30:00', 0,'',0),
(102, 1, 'H3','E4', NULL,NULL, NULL,NULL,'','2026-05-24 10:00:00', 0,'',0),
(103, 1, 'E4','E2', NULL,NULL, NULL,NULL,'','2026-05-24 10:30:00', 0,'',0),
(104, 1, 'E2','G2', NULL,NULL, NULL,NULL,'','2026-05-24 11:00:00', 0,'',0),
(105, 1, 'G2','E1', NULL,NULL, NULL,NULL,'','2026-05-24 14:00:00', 0,'',0),
(106, 1, 'E1','G1', NULL,NULL, NULL,NULL,'','2026-05-24 14:30:00', 0,'',0),
(107, 1, 'G1','E3', NULL,NULL, NULL,NULL,'','2026-05-24 15:00:00', 0,'',0),
(108, 1, 'E3','G3', NULL,NULL, NULL,NULL,'','2026-05-24 15:30:00', 0,'',0),
(109, 1, 'G3','F1', NULL,NULL, NULL,NULL,'','2026-05-24 16:00:00', 0,'',0),
(110, 1, 'F1','H1', NULL,NULL, NULL,NULL,'','2026-05-24 16:30:00', 0,'',0),
(111, 1, 'H1','F3', NULL,NULL, NULL,NULL,'','2026-05-24 17:00:00', 0,'',0),
(112, 1, 'F3','H4', NULL,NULL, NULL,NULL,'','2026-05-24 17:30:00', 0,'',0),
(113, 1, 'H4','F4', NULL,NULL, NULL,NULL,'','2026-05-24 18:00:00', 0,'',0),
(114, 1, 'F4','G4', NULL,NULL, NULL,NULL,'','2026-05-24 18:30:00', 0,'',0),
(115, 1, 'G4','F2', NULL,NULL, NULL,NULL,'','2026-05-24 19:00:00', 0,'',0),
(116, 1, 'F2','H2', NULL,NULL, NULL,NULL,'','2026-05-24 19:30:00', 0,'',0);

COMMIT;

-- =============================================================================
-- Recapitulatif :
--   ta_configuration : 1 ligne
--   ta_equipes       : 16 equipes J1
--   ta_classement    : 48 lignes
--     J1 A/B/C/D    : 16 lignes
--     J2 E/F/G/H    : 16 lignes
--     J3 I/J/K/L    : 16 lignes de structure, sans equipe finale resolue
--   TA_MATCHS        : 80 lignes
--     J1 5v5         : 24 (NUM   1-24,  2026-05-23)
--     J2 5v5         : 24 (NUM  25-48,  2026-05-24)
--     J3 Phase1      :  8 (NUM  49-56,  2026-05-25)
--     J3 Phase2      :  8 (NUM  57-64,  2026-05-25)
--     J2 3v3         : 16 (NUM 101-116, 2026-05-24)
--   ta_joueurs       : vide
-- =============================================================================
