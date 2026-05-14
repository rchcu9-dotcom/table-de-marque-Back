# ADR – Drivers de données (mémoire / Sheets / MySQL)

## Contexte
- Sources actuelles : Google Sheets (matchs, équipes), mocks mémoire pour combler ou accélérer, futur MySQL (dump existant partiel).
- Besoin de brancher progressivement MySQL sans casser les mocks, garder un fallback pour données manquantes (jour3, 3v3, challenge).

## Options
- A. Drivers configurables par ressource (matches, équipes, challenge) : mémoire, sheets, mysql. Fallback mémoire si données absentes.
- B. Basculer tout en MySQL d’un coup (risqué car dump partiel).
- C. Rester full mock/sheets (pas d’évolution).

## Décision
- Retenir A : drivers par ressource, activables via env (`*_REPOSITORY_DRIVER` ou `USE_MYSQL_*`), avec fallback mémoire pour compléter. Basculer table par table.

## Plan progressif
- Ajouter MySQL dans l’ORM (Prisma) et repo MySQL par ressource.
- Étape 1 : Équipes en MySQL (fallback mock pour logos/manquants).
- Étape 2 : Matches 5v5 MySQL, fallback pour J3/3v3/challenge.
- Étape 3 : Étendre le schéma/dump pour couvrir 3v3/challenge, réduire le mock.
- Garder le mock seeder pour compléter tant que la base n’est pas complète.

## Impacts
- Env vars : `DB_DRIVER=mysql` ou `USE_MYSQL_*`, `DATABASE_URL`, drivers par ressource.
- Tests : vérifier chaque driver et le fallback ; filtrage serveur (teamId/competition) dans toutes les implémentations.
- Perf : cache court/long selon ressource ; pré-agrégation pour standings si MySQL utilisé.
