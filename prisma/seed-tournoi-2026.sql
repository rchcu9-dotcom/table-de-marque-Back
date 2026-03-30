-- =============================================================================
-- Seed base test — Tournoi RCHC 2026
-- J1 = 23/05/2026 (samedi)   — 16 matchs 5v5, challenge, repas
-- J2 = 24/05/2026 (dimanche) — 24 matchs 5v5 + 16 matchs 3v3, repas
-- J3 = 25/05/2026 (lundi)    — 8 Phase1 5v5 + 8 Phase2 5v5
--
-- Structure DB gérée par Prisma (migrations).
-- Ce script se contente de (re)charger les données de test.
--
-- NUM_MATCH  >  100 → 3v3  (règle hardcodée dans le repository)
-- NUM_MATCH  <= 100 → 5v5
-- SURFACAGE  =    0 → match réel  (filtré par le repository)
--
-- Groupes J1 : A={Meyrin,Champigny,Dammarie/Cergy,Orléans}
--              B={Rennes,Neuilly,FILlesDeFrance,Meudon}
--              C={Cholet,Le Havre,Evry-Viry,Courbevoie}
--              D={Tours,Les Volants,La Roche sur Yon,Rouen}
--
-- Groupes J2 (cross-J1) :
--   Pool A (J3=OA) : A1 A2 B1 B2   — Or
--   Pool B (J3=OB) : C1 C2 D1 D2   — Or
--   Pool C (J3=AC) : A3 A4 B3 B4   — Argent
--   Pool D (J3=AD) : C3 C4 D3 D4   — Argent
--
-- J3 naming : vXnYm = vainqueur match J3P1 Xn vs Ym,  pXnYm = perdant
-- (backend regex inferJ3PouleCode à mettre à jour séparément)
-- =============================================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";
/*!40101 SET NAMES utf8mb4 */;

USE `rchcu11_tournoi_test`;

-- ─── Nettoyage ────────────────────────────────────────────────────────────────
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
   3, 'Porte (+3)', '(5 secondes en plus par but encaissé)', 5);

-- =============================================================================
-- ta_equipes — 16 équipes J1 (IDs issus du planning-j1 2026-03-07)
-- Remplacements : Compiègne→FILlesDeFrance, Angers→Orléans,
--                Valenciennes→La Roche sur Yon, Dammarie→Dammarie/Cergy
-- REPAS_SAMEDI    = créneau repas J1   (planning JSON)
-- CHALLENGE_SAMEDI= créneau challenge J1 (planning JSON)
-- =============================================================================
INSERT INTO `ta_equipes`
  (`ID`,`EQUIPE`,`REPAS_SAMEDI`,`CHALLENGE_SAMEDI`,`REPAS_DIMANCHE`,
   `IMAGE`,`COULEUR_FONT`,`COULEUR_BACK`,
   `COACH_1`,`COACH_2`,`COACH_3`,`COACH_4`)
VALUES
-- Pool A ─────────────────────────────────────────────────────────────────────
(1,  'Meyrin',           '2026-05-23 11:05:00','2026-05-23 19:00:00', '2026-05-24 11:05:00', 'meyrin.png',           '000000','feb71f', '','','',''),
(2,  'Champigny',        '2026-05-23 12:35:00','2026-05-23 18:20:00', '2026-05-24 13:25:00', 'champigny.png',        'ffffff','427ab1', '','','',''),
(3,  'Dammarie/Cergy',   '2026-05-23 11:50:00','2026-05-23 15:00:00', '2026-05-24 11:15:00', 'dammarie.png',         'ffffff','ca8924', '','','',''),
(4,  'Orléans',          '2026-05-23 12:40:00','2026-05-23 11:00:00', '2026-05-24 12:45:00', 'orleans.png',          'ffffff','006633', '','','',''),
-- Pool B ─────────────────────────────────────────────────────────────────────
(5,  'Rennes',           '2026-05-23 11:15:00','2026-05-23 14:20:00', '2026-05-24 11:50:00', 'rennes.png',           '000000','49a53f', '','','',''),
(6,  'Meudon',           '2026-05-23 13:15:00','2026-05-23 09:40:00', '2026-05-24 12:30:00', 'meudon.png',           'fcc72e','8e2e33', '','','',''),
(7,  'FILlesDeFrance',   '2026-05-23 12:00:00','2026-05-23 16:20:00', '2026-05-24 12:35:00', 'fillesdefrance.png',   'ffffff','ff69b4', '','','',''),
(8,  'Neuilly',          '2026-05-23 11:10:00','2026-05-23 13:00:00', '2026-05-24 12:40:00', 'neuilly.png',          'e2001a','180101', '','','',''),
-- Pool C ─────────────────────────────────────────────────────────────────────
(9,  'Cholet',           '2026-05-23 11:45:00','2026-05-23 15:40:00', '2026-05-24 11:10:00', 'cholet.png',           'ffffff','e3131b', '','','',''),
(10, 'Le Havre',         '2026-05-23 13:20:00','2026-05-23 09:00:00', '2026-05-24 11:45:00', 'lehavre.png',          'ffffff','51aad6', '','','',''),
(11, 'Evry-Viry',        '2026-05-23 12:45:00','2026-05-23 17:00:00', '2026-05-24 11:55:00', 'evryviry.png',         'ffff00','0c1e3b', '','','',''),
(12, 'Courbevoie',       '2026-05-23 13:25:00','2026-05-23 12:20:00', '2026-05-24 13:20:00', 'courbevoie.png',       'ffffff','d9221c', '','','',''),
-- Pool D ─────────────────────────────────────────────────────────────────────
(13, 'Tours',            '2026-05-23 12:30:00','2026-05-23 11:40:00', '2026-05-24 12:00:00', 'tours.png',            '000000','ff6600', '','','',''),
(14, 'La Roche sur Yon', '2026-05-23 13:30:00','2026-05-23 10:20:00', '2026-05-24 13:30:00', 'larochesuryon.png',    'ffffff','003399', '','','',''),
(15, 'Rouen',            '2026-05-23 11:00:00','2026-05-23 17:40:00', '2026-05-24 11:00:00', 'rouen.png',            'ffffff','005f9e', '','','',''),
(16, 'Les Volants',      '2026-05-23 11:55:00','2026-05-23 13:40:00', '2026-05-24 13:15:00', 'lesvolants.png',       '000000','ffcc00', '','','','');

-- =============================================================================
-- ta_classement — Standings J1 (valeurs fictives cohérentes pour la DB test)
-- ORDRE       = rang dans le groupe (1=1er)
-- ORDRE_FINAL = classement général inter-groupes (seeding J2)
--   1=A1, 2=B1, 3=C1, 4=D1, 5=A2, 6=B2, 7=C2, 8=D2,
--   9=A3,10=B3,11=C3,12=D3,13=A4,14=B4,15=C4,16=D4
-- =============================================================================
INSERT INTO `ta_classement`
  (`GROUPE_NOM`,`ORDRE`,`ORDRE_FINAL`,`EQUIPE`,`EQUIPE_ID`,
   `J`,`V`,`N`,`D`,`PTS`,`BP`,`BC`,`DIFF`,
   `REPAS_SAMEDI`,`CHALLENGE_SAMEDI`)
VALUES
-- Groupe A ───────────────────────────────────────────────────────────────────
('A', 1,  1, 'Meyrin',           1,  0, 0, 0, 0, 0, 0, 0, 0, '2026-05-23 11:05:00','2026-05-23 19:00:00'),
('A', 2,  5, 'Champigny',        2,  0, 0, 0, 0, 0, 0, 0, 0, '2026-05-23 12:35:00','2026-05-23 18:20:00'),
('A', 3,  9, 'Dammarie/Cergy',   3,  0, 0, 0, 0, 0, 0, 0, 0, '2026-05-23 11:50:00','2026-05-23 15:00:00'),
('A', 4, 13, 'Orléans',          4,  0, 0, 0, 0, 0, 0, 0, 0, '2026-05-23 12:40:00','2026-05-23 11:00:00'),
-- Groupe B ───────────────────────────────────────────────────────────────────
('B', 1,  2, 'Rennes',           5,  0, 0, 0, 0, 0, 0, 0, 0, '2026-05-23 11:15:00','2026-05-23 14:20:00'),
('B', 2,  6, 'Neuilly',          8,  0, 0, 0, 0, 0, 0, 0, 0, '2026-05-23 11:10:00','2026-05-23 13:00:00'),
('B', 3, 10, 'FILlesDeFrance',   7,  0, 0, 0, 0, 0, 0, 0, 0, '2026-05-23 12:00:00','2026-05-23 16:20:00'),
('B', 4, 14, 'Meudon',           6,  0, 0, 0, 0, 0, 0, 0, 0, '2026-05-23 13:15:00','2026-05-23 09:40:00'),
-- Groupe C ───────────────────────────────────────────────────────────────────
('C', 1,  3, 'Cholet',           9,  0, 0, 0, 0, 0, 0, 0, 0, '2026-05-23 11:45:00','2026-05-23 15:40:00'),
('C', 2,  7, 'Le Havre',         10, 0, 0, 0, 0, 0, 0, 0, 0, '2026-05-23 13:20:00','2026-05-23 09:00:00'),
('C', 3, 11, 'Evry-Viry',        11, 0, 0, 0, 0, 0, 0, 0, 0, '2026-05-23 12:45:00','2026-05-23 17:00:00'),
('C', 4, 15, 'Courbevoie',       12, 0, 0, 0, 0, 0, 0, 0, 0, '2026-05-23 13:25:00','2026-05-23 12:20:00'),
-- Groupe D ───────────────────────────────────────────────────────────────────
('D', 1,  4, 'Tours',            13, 0, 0, 0, 0, 0, 0, 0, 0, '2026-05-23 12:30:00','2026-05-23 11:40:00'),
('D', 2,  8, 'Les Volants',      16, 0, 0, 0, 0, 0, 0, 0, 0, '2026-05-23 11:55:00','2026-05-23 13:40:00'),
('D', 3, 12, 'La Roche sur Yon', 14, 0, 0, 0, 0, 0, 0, 0, 0, '2026-05-23 13:30:00','2026-05-23 10:20:00'),
('D', 4, 16, 'Rouen',            15, 0, 0, 0, 0, 0, 0, 0, 0, '2026-05-23 11:00:00','2026-05-23 17:40:00'),

-- =============================================================================
-- ta_classement — J2 init (4 pools cross-J1, tout à 0)
-- GROUPE_NOM '1'/'2'/'3'/'4' pour éviter conflit PK avec J1 (A/B/C/D)
--   '1' = pool A (J3=OA) : A1 A2 B1 B2
--   '2' = pool B (J3=OB) : C1 C2 D1 D2
--   '3' = pool C (J3=AC) : A3 A4 B3 B4
--   '4' = pool D (J3=AD) : C3 C4 D3 D4
-- EQUIPE_ID 101–116 : mapping fixe des noms génériques J2
--   A1=101 A2=102 B1=103 B2=104 C1=105 C2=106 D1=107 D2=108
--   A3=109 A4=110 B3=111 B4=112 C3=113 C4=114 D3=115 D4=116
-- =============================================================================
-- Pool 1 (A) : A1 A2 B1 B2 ───────────────────────────────────────────────────
('1', 1, 1, 'A1', 101, 0,0,0,0,0,0,0,0, NULL,NULL),
('1', 2, 2, 'A2', 102, 0,0,0,0,0,0,0,0, NULL,NULL),
('1', 3, 3, 'B1', 103, 0,0,0,0,0,0,0,0, NULL,NULL),
('1', 4, 4, 'B2', 104, 0,0,0,0,0,0,0,0, NULL,NULL),
-- Pool 2 (B) : C1 C2 D1 D2 ───────────────────────────────────────────────────
('2', 1, 1, 'C1', 105, 0,0,0,0,0,0,0,0, NULL,NULL),
('2', 2, 2, 'C2', 106, 0,0,0,0,0,0,0,0, NULL,NULL),
('2', 3, 3, 'D1', 107, 0,0,0,0,0,0,0,0, NULL,NULL),
('2', 4, 4, 'D2', 108, 0,0,0,0,0,0,0,0, NULL,NULL),
-- Pool 3 (C) : A3 A4 B3 B4 ───────────────────────────────────────────────────
('3', 1, 1, 'A3', 109, 0,0,0,0,0,0,0,0, NULL,NULL),
('3', 2, 2, 'A4', 110, 0,0,0,0,0,0,0,0, NULL,NULL),
('3', 3, 3, 'B3', 111, 0,0,0,0,0,0,0,0, NULL,NULL),
('3', 4, 4, 'B4', 112, 0,0,0,0,0,0,0,0, NULL,NULL),
-- Pool 4 (D) : C3 C4 D3 D4 ───────────────────────────────────────────────────
('4', 1, 1, 'C3', 113, 0,0,0,0,0,0,0,0, NULL,NULL),
('4', 2, 2, 'C4', 114, 0,0,0,0,0,0,0,0, NULL,NULL),
('4', 3, 3, 'D3', 115, 0,0,0,0,0,0,0,0, NULL,NULL),
('4', 4, 4, 'D4', 116, 0,0,0,0,0,0,0,0, NULL,NULL),

-- =============================================================================
-- ta_classement — J3 Phase 1 init (groupes E=Or, F=Argent, tout à 0)
-- 8 équipes par groupe = les participants aux demi-finales J3
-- Groupe E (Or)    : équipes J2 pools A+C  (slots Phase1 3,4,7,8)
-- Groupe F (Argent): équipes J2 pools B+D  (slots Phase1 1,2,5,6)
-- ORDRE_FINAL = ORDRE (init, classement inconnu)
-- =============================================================================
-- Groupe E : Or Phase 1 ───────────────────────────────────────────────────────
('E', 1, 1, 'A1', 101, 0,0,0,0,0,0,0,0, NULL,NULL),
('E', 2, 2, 'B1', 103, 0,0,0,0,0,0,0,0, NULL,NULL),
('E', 3, 3, 'B2', 104, 0,0,0,0,0,0,0,0, NULL,NULL),
('E', 4, 4, 'A2', 102, 0,0,0,0,0,0,0,0, NULL,NULL),
('E', 5, 5, 'A3', 109, 0,0,0,0,0,0,0,0, NULL,NULL),
('E', 6, 6, 'B3', 111, 0,0,0,0,0,0,0,0, NULL,NULL),
('E', 7, 7, 'B4', 112, 0,0,0,0,0,0,0,0, NULL,NULL),
('E', 8, 8, 'A4', 110, 0,0,0,0,0,0,0,0, NULL,NULL),
-- Groupe F : Argent Phase 1 ───────────────────────────────────────────────────
('F', 1, 1, 'C1', 105, 0,0,0,0,0,0,0,0, NULL,NULL),
('F', 2, 2, 'D1', 107, 0,0,0,0,0,0,0,0, NULL,NULL),
('F', 3, 3, 'D2', 108, 0,0,0,0,0,0,0,0, NULL,NULL),
('F', 4, 4, 'C2', 106, 0,0,0,0,0,0,0,0, NULL,NULL),
('F', 5, 5, 'C3', 113, 0,0,0,0,0,0,0,0, NULL,NULL),
('F', 6, 6, 'D3', 115, 0,0,0,0,0,0,0,0, NULL,NULL),
('F', 7, 7, 'D4', 116, 0,0,0,0,0,0,0,0, NULL,NULL),
('F', 8, 8, 'C4', 114, 0,0,0,0,0,0,0,0, NULL,NULL),

-- =============================================================================
-- ta_classement — J3 Phase 2 init (groupes G=Losers, J=Winners, tout à 0)
-- EQUIPE_ID 201–208 losers, 209–216 winners
-- Groupe G : entités bracket perdants ─────────────────────────────────────────
('G', 1, 1, 'pA1B2', 201, 0,0,0,0,0,0,0,0, NULL,NULL),
('G', 2, 2, 'pB1A2', 202, 0,0,0,0,0,0,0,0, NULL,NULL),
('G', 3, 3, 'pA3B4', 203, 0,0,0,0,0,0,0,0, NULL,NULL),
('G', 4, 4, 'pB3A4', 204, 0,0,0,0,0,0,0,0, NULL,NULL),
('G', 5, 5, 'pC1D2', 205, 0,0,0,0,0,0,0,0, NULL,NULL),
('G', 6, 6, 'pD1C2', 206, 0,0,0,0,0,0,0,0, NULL,NULL),
('G', 7, 7, 'pC3D4', 207, 0,0,0,0,0,0,0,0, NULL,NULL),
('G', 8, 8, 'pD3C4', 208, 0,0,0,0,0,0,0,0, NULL,NULL),
-- Groupe J : entités bracket vainqueurs ───────────────────────────────────────
('J', 1, 1, 'vA1B2', 209, 0,0,0,0,0,0,0,0, NULL,NULL),
('J', 2, 2, 'vB1A2', 210, 0,0,0,0,0,0,0,0, NULL,NULL),
('J', 3, 3, 'vA3B4', 211, 0,0,0,0,0,0,0,0, NULL,NULL),
('J', 4, 4, 'vB3A4', 212, 0,0,0,0,0,0,0,0, NULL,NULL),
('J', 5, 5, 'vC1D2', 213, 0,0,0,0,0,0,0,0, NULL,NULL),
('J', 6, 6, 'vD1C2', 214, 0,0,0,0,0,0,0,0, NULL,NULL),
('J', 7, 7, 'vC3D4', 215, 0,0,0,0,0,0,0,0, NULL,NULL),
('J', 8, 8, 'vD3C4', 216, 0,0,0,0,0,0,0,0, NULL,NULL);

-- =============================================================================
-- TA_MATCHS — J1 5v5 (NUM 1–24, date 2026-05-23)
-- Planning une seule glace, 24 matchs séquentiels (espacement ~27 min)
-- Groupes : A=pool0, B=pool1, C=pool2, D=pool3
-- =============================================================================
INSERT INTO `TA_MATCHS`
  (`NUM_MATCH`,`MATCH_CASE`,`EQUIPE1`,`EQUIPE2`,`EQUIPE_ID1`,`EQUIPE_ID2`,
   `SCORE1`,`SCORE2`,`ETAT`,`DATEHEURE`,`SURFACAGE`,`ECART`,`NB_PHOTOS`)
VALUES
-- Batch 1 (round-robin, 1 match par poule) ───────────────────────────────────
(  1, 1, 'Meyrin',           'Orléans',          1,  4,  NULL,NULL,'','2026-05-23 09:00:00', 0,'',0),
(  2, 1, 'Rennes',           'Neuilly',           5,  8,  NULL,NULL,'','2026-05-23 09:27:00', 0,'',0),
(  3, 1, 'Cholet',           'Courbevoie',        9,  12, NULL,NULL,'','2026-05-23 09:54:00', 0,'',0),
(  4, 1, 'Tours',            'Les Volants',       13, 16, NULL,NULL,'','2026-05-23 10:21:00', 0,'',0),
(  5, 1, 'Champigny',        'Dammarie/Cergy',    2,  3,  NULL,NULL,'','2026-05-23 11:08:00', 0,'',0),
(  6, 1, 'FILlesDeFrance',   'Meudon',            7,  6,  NULL,NULL,'','2026-05-23 11:35:00', 0,'',0),
(  7, 1, 'Le Havre',         'Evry-Viry',         10, 11, NULL,NULL,'','2026-05-23 12:02:00', 0,'',0),
(  8, 1, 'La Roche sur Yon', 'Rouen',             14, 15, NULL,NULL,'','2026-05-23 12:29:00', 0,'',0),
-- Batch 2 (round 2) ──────────────────────────────────────────────────────────
(  9, 1, 'Meyrin',           'Dammarie/Cergy',    1,  3,  NULL,NULL,'','2026-05-23 13:16:00', 0,'',0),
( 10, 1, 'FILlesDeFrance',   'Rennes',            7,  5,  NULL,NULL,'','2026-05-23 13:43:00', 0,'',0),
( 11, 1, 'Cholet',           'Evry-Viry',         9,  11, NULL,NULL,'','2026-05-23 14:10:00', 0,'',0),
( 12, 1, 'Tours',            'Rouen',             13, 15, NULL,NULL,'','2026-05-23 14:37:00', 0,'',0),
( 13, 1, 'Orléans',          'Champigny',         4,  2,  NULL,NULL,'','2026-05-23 15:24:00', 0,'',0),
( 14, 1, 'Neuilly',          'Meudon',            8,  6,  NULL,NULL,'','2026-05-23 15:51:00', 0,'',0),
( 15, 1, 'Le Havre',         'Courbevoie',        10, 12, NULL,NULL,'','2026-05-23 16:18:00', 0,'',0),
( 16, 1, 'Les Volants',      'La Roche sur Yon',  16, 14, NULL,NULL,'','2026-05-23 16:45:00', 0,'',0),
-- Batch 3 (round 3) ──────────────────────────────────────────────────────────
( 17, 1, 'Meyrin',           'Champigny',         1,  2,  NULL,NULL,'','2026-05-23 17:32:00', 0,'',0),
( 18, 1, 'Rennes',           'Meudon',            5,  6,  NULL,NULL,'','2026-05-23 17:59:00', 0,'',0),
( 19, 1, 'Cholet',           'Le Havre',          9,  10, NULL,NULL,'','2026-05-23 18:26:00', 0,'',0),
( 20, 1, 'Tours',            'La Roche sur Yon',  13, 14, NULL,NULL,'','2026-05-23 18:53:00', 0,'',0),
( 21, 1, 'Orléans',          'Dammarie/Cergy',    4,  3,  NULL,NULL,'','2026-05-23 19:40:00', 0,'',0),
( 22, 1, 'Neuilly',          'FILlesDeFrance',    8,  7,  NULL,NULL,'','2026-05-23 20:07:00', 0,'',0),
( 23, 1, 'Evry-Viry',        'Courbevoie',        11, 12, NULL,NULL,'','2026-05-23 20:34:00', 0,'',0),
( 24, 1, 'Les Volants',      'Rouen',             16, 15, NULL,NULL,'','2026-05-23 21:01:00', 0,'',0),

-- =============================================================================
-- TA_MATCHS — J2 5v5 (NUM 25–48, date 2026-05-24)
-- 4 pools cross-J1, round-robin intra-pool (6 matchs × 4 pools = 24)
-- Pool A(J3=OA) : A1 A2 B1 B2  | Pool B(J3=OB) : C1 C2 D1 D2
-- Pool C(J3=AC) : A3 A4 B3 B4  | Pool D(J3=AD) : C3 C4 D3 D4
-- EQUIPE_ID1/ID2 = NULL (pas de mapping vers ta_equipes)
-- Le backend détermine les pools par union-find sur les matchs.
-- =============================================================================
-- Pool A : A1 A2 B1 B2 ───────────────────────────────────────────────────────
( 25, 1, 'A1','A2', NULL,NULL, NULL,NULL,'','2026-05-24 09:00:00', 0,'',0),
( 29, 1, 'B2','B1', NULL,NULL, NULL,NULL,'','2026-05-24 11:08:00', 0,'',0),
( 33, 1, 'A1','B1', NULL,NULL, NULL,NULL,'','2026-05-24 13:16:00', 0,'',0),
( 37, 1, 'A2','B2', NULL,NULL, NULL,NULL,'','2026-05-24 15:24:00', 0,'',0),
( 41, 1, 'A1','B2', NULL,NULL, NULL,NULL,'','2026-05-24 17:32:00', 0,'',0),
( 45, 1, 'A2','B1', NULL,NULL, NULL,NULL,'','2026-05-24 19:40:00', 0,'',0),
-- Pool B : C1 C2 D1 D2 ───────────────────────────────────────────────────────
( 26, 1, 'C1','C2', NULL,NULL, NULL,NULL,'','2026-05-24 09:27:00', 0,'',0),
( 30, 1, 'D1','D2', NULL,NULL, NULL,NULL,'','2026-05-24 11:35:00', 0,'',0),
( 34, 1, 'D1','C1', NULL,NULL, NULL,NULL,'','2026-05-24 13:43:00', 0,'',0),
( 38, 1, 'C2','D2', NULL,NULL, NULL,NULL,'','2026-05-24 15:51:00', 0,'',0),
( 42, 1, 'C1','D2', NULL,NULL, NULL,NULL,'','2026-05-24 17:59:00', 0,'',0),
( 46, 1, 'C2','D1', NULL,NULL, NULL,NULL,'','2026-05-24 20:07:00', 0,'',0),
-- Pool C : A3 A4 B3 B4 ───────────────────────────────────────────────────────
( 27, 1, 'A3','B4', NULL,NULL, NULL,NULL,'','2026-05-24 09:54:00', 0,'',0),
( 31, 1, 'A4','B3', NULL,NULL, NULL,NULL,'','2026-05-24 12:02:00', 0,'',0),
( 35, 1, 'A3','B3', NULL,NULL, NULL,NULL,'','2026-05-24 14:10:00', 0,'',0),
( 39, 1, 'A4','B4', NULL,NULL, NULL,NULL,'','2026-05-24 16:18:00', 0,'',0),
( 43, 1, 'A3','A4', NULL,NULL, NULL,NULL,'','2026-05-24 18:26:00', 0,'',0),
( 47, 1, 'B3','B4', NULL,NULL, NULL,NULL,'','2026-05-24 20:34:00', 0,'',0),
-- Pool D : C3 C4 D3 D4 ───────────────────────────────────────────────────────
( 28, 1, 'C3','C4', NULL,NULL, NULL,NULL,'','2026-05-24 10:21:00', 0,'',0),
( 32, 1, 'D3','D4', NULL,NULL, NULL,NULL,'','2026-05-24 12:29:00', 0,'',0),
( 36, 1, 'C3','D4', NULL,NULL, NULL,NULL,'','2026-05-24 14:37:00', 0,'',0),
( 40, 1, 'C4','D3', NULL,NULL, NULL,NULL,'','2026-05-24 16:45:00', 0,'',0),
( 44, 1, 'C3','D3', NULL,NULL, NULL,NULL,'','2026-05-24 18:53:00', 0,'',0),
( 48, 1, 'C4','D4', NULL,NULL, NULL,NULL,'','2026-05-24 21:01:00', 0,'',0),

-- =============================================================================
-- TA_MATCHS — J3 Phase 1 (NUM 49–56, date 2026-05-25, 08:00–11:24)
-- 8 demi-finales fixes, une seule glace
-- Batch 1 : 08:00 08:27 08:54 09:21  → surfaçage 20' → 10:03
-- Batch 2 : 10:03 10:30 10:57 11:24  → surfaçage 20' → 12:06
--
-- Naming : Xn = nième de la pool J2 X (A=OA, B=OB, C=AC, D=AD)
-- Slots 1-2 : AC3/AD4 vs AD3/AC4   (Argent : C3vsD4, D3vsC4)
-- Slots 3-4 : OA3/OB4 vs OB3/OA4   (Or     : A3vsB4, B3vsA4)
-- Slots 5-6 : AC1/AD2 vs AD1/AC2   (Argent : C1vsD2, D1vsC2)
-- Slots 7-8 : OA1/OB2 vs OB1/OA2   (Or     : A1vsB2, B1vsA2)
-- =============================================================================
( 49, 1, 'C3','D4', NULL,NULL, NULL,NULL,'','2026-05-25 08:00:00', 0,'',0),
( 50, 1, 'D3','C4', NULL,NULL, NULL,NULL,'','2026-05-25 08:27:00', 0,'',0),
( 51, 1, 'A3','B4', NULL,NULL, NULL,NULL,'','2026-05-25 08:54:00', 0,'',0),
( 52, 1, 'B3','A4', NULL,NULL, NULL,NULL,'','2026-05-25 09:21:00', 0,'',0),
( 53, 1, 'C1','D2', NULL,NULL, NULL,NULL,'','2026-05-25 10:03:00', 0,'',0),
( 54, 1, 'D1','C2', NULL,NULL, NULL,NULL,'','2026-05-25 10:30:00', 0,'',0),
( 55, 1, 'A1','B2', NULL,NULL, NULL,NULL,'','2026-05-25 10:57:00', 0,'',0),
( 56, 1, 'B1','A2', NULL,NULL, NULL,NULL,'','2026-05-25 11:24:00', 0,'',0),

-- =============================================================================
-- TA_MATCHS — J3 Phase 2 (NUM 57–64, date 2026-05-25, 12:06–15:45)
-- 4 matchs losers (batch 3) + 4 matchs winners (batch 4)
-- Batch 3 : 12:06 12:33 13:00 13:27  → surfaçage 20' → 14:09
-- Batch 4 : 14:09 14:36 15:03 15:45  (945' = finale après surf extra)
--
-- EQUIPE1/EQUIPE2 = noms des entités bracket issues de Phase 1 :
--   pXnYm = perdant du match Xn vs Ym (loser bracket)
--   vXnYm = vainqueur du match Xn vs Ym (winner bracket)
--
-- Ordre batch 3 issu de l'optimiseur SA (loserOrder optimal) :
--   Slot 9  (12:06) : losers[1] pA3B4  vs pB3A4
--   Slot 10 (12:33) : losers[2] pC1D2  vs pD1C2
--   Slot 11 (13:00) : losers[0] pC3D4  vs pD3C4
--   Slot 12 (13:27) : losers[3] pA1B2  vs pB1A2
-- Ordre batch 4 issu de l'optimiseur SA (winnerOrder optimal) :
--   Slot 13 (14:09) : winners[0] vC3D4 vs vD3C4
--   Slot 14 (14:36) : winners[1] vA3B4 vs vB3A4
--   Slot 15 (15:03) : winners[2] vC1D2 vs vD1C2
--   Slot 16 (15:45) : winners[3] vA1B2 vs vB1A2  ← FINALE
-- =============================================================================
-- Batch 3 — Losers ────────────────────────────────────────────────────────────
( 57, 1, 'pA3B4','pB3A4', NULL,NULL, NULL,NULL,'','2026-05-25 12:06:00', 0,'',0),
( 58, 1, 'pC1D2','pD1C2', NULL,NULL, NULL,NULL,'','2026-05-25 12:33:00', 0,'',0),
( 59, 1, 'pC3D4','pD3C4', NULL,NULL, NULL,NULL,'','2026-05-25 13:00:00', 0,'',0),
( 60, 1, 'pA1B2','pB1A2', NULL,NULL, NULL,NULL,'','2026-05-25 13:27:00', 0,'',0),
-- Batch 4 — Winners (+ Finale) ────────────────────────────────────────────────
( 61, 1, 'vC3D4','vD3C4', NULL,NULL, NULL,NULL,'','2026-05-25 14:09:00', 0,'',0),
( 62, 1, 'vA3B4','vB3A4', NULL,NULL, NULL,NULL,'','2026-05-25 14:36:00', 0,'',0),
( 63, 1, 'vC1D2','vD1C2', NULL,NULL, NULL,NULL,'','2026-05-25 15:03:00', 0,'',0),
( 64, 1, 'vA1B2','vB1A2', NULL,NULL, NULL,NULL,'','2026-05-25 15:45:00', 0,'',0),

-- =============================================================================
-- TA_MATCHS — J2 3v3 (NUM 101–116, date 2026-05-24)
-- NUM_MATCH > 100 → identifié comme 3v3 par le repository
-- Chaîne circulaire de 16 équipes (2 matchs par équipe)
-- Contrainte : pas deux équipes du même pool J2 cross-groupe consécutives
-- Pools cross-groupe : OA={A1,A2,B1,B2} OB={C1,C2,D1,D2} AC={A3,A4,B3,B4} AD={C3,C4,D3,D4}
-- Chaîne optimisée : D2-D3-A4-A2-C2-A1-C1-A3-C3-B1-D1-B3-D4-B4-C4-B2-[D2]
-- Créneaux 3v3 : 09:30 10:00 10:30 11:00 14:00 14:30 15:00 15:30
--               16:00 16:30 17:00 17:30 18:30 19:00 19:30 20:00
-- (gap 17:30–18:30 = surfaçage glace PG)
-- Match i : chainOrder[i] vs chainOrder[(i+1)%16]
-- =============================================================================
(101, 1, 'D2','D3', NULL,NULL, NULL,NULL,'','2026-05-24 09:30:00', 0,'',0),
(102, 1, 'D3','A4', NULL,NULL, NULL,NULL,'','2026-05-24 10:00:00', 0,'',0),
(103, 1, 'A4','A2', NULL,NULL, NULL,NULL,'','2026-05-24 10:30:00', 0,'',0),
(104, 1, 'A2','C2', NULL,NULL, NULL,NULL,'','2026-05-24 11:00:00', 0,'',0),
(105, 1, 'C2','A1', NULL,NULL, NULL,NULL,'','2026-05-24 14:00:00', 0,'',0),
(106, 1, 'A1','C1', NULL,NULL, NULL,NULL,'','2026-05-24 14:30:00', 0,'',0),
(107, 1, 'C1','A3', NULL,NULL, NULL,NULL,'','2026-05-24 15:00:00', 0,'',0),
(108, 1, 'A3','C3', NULL,NULL, NULL,NULL,'','2026-05-24 15:30:00', 0,'',0),
(109, 1, 'C3','B1', NULL,NULL, NULL,NULL,'','2026-05-24 16:00:00', 0,'',0),
(110, 1, 'B1','D1', NULL,NULL, NULL,NULL,'','2026-05-24 16:30:00', 0,'',0),
(111, 1, 'D1','B3', NULL,NULL, NULL,NULL,'','2026-05-24 17:00:00', 0,'',0),
(112, 1, 'B3','D4', NULL,NULL, NULL,NULL,'','2026-05-24 17:30:00', 0,'',0),
(113, 1, 'D4','B4', NULL,NULL, NULL,NULL,'','2026-05-24 18:30:00', 0,'',0),
(114, 1, 'B4','C4', NULL,NULL, NULL,NULL,'','2026-05-24 19:00:00', 0,'',0),
(115, 1, 'C4','B2', NULL,NULL, NULL,NULL,'','2026-05-24 19:30:00', 0,'',0),
(116, 1, 'B2','D2', NULL,NULL, NULL,NULL,'','2026-05-24 20:00:00', 0,'',0);

COMMIT;

-- =============================================================================
-- Récapitulatif des données insérées :
--   ta_configuration : 1 ligne
--   ta_equipes       : 16 équipes (IDs 1–16, noms 2026 avec remplacements)
--   ta_classement    : 16 lignes (groupes A B C D, standings fictifs)
--   TA_MATCHS        :
--     J1 5v5    : 24 matchs (NUM   1– 24, 2026-05-23)
--     J2 5v5    : 24 matchs (NUM  25– 48, 2026-05-24)
--     J3 Phase1 :  8 matchs (NUM  49– 56, 2026-05-25)
--     J3 Phase2 :  8 matchs (NUM  57– 64, 2026-05-25)
--     J2 3v3    : 16 matchs (NUM 101–116, 2026-05-24)
--   Total TA_MATCHS  : 80 lignes
--   ta_joueurs       : vide (données individuelles non requises pour ce test)
-- =============================================================================
