# Bascule de staging sur la base de PRODUCTION + mode « Préparation tournoi »

Migration : `prisma/migrations/20261018000000_prod_rattrapage_preparation_tournoi/migration.sql`.

## Ce que fait la migration (sur `rchcu11_tournoi`)

1. Crée les 20 tables absentes de la prod (`insc_*`, `planning_*`, `format_*`,
   `presentation_articles`) et leurs clés étrangères — `CREATE TABLE IF NOT EXISTS`,
   `FOREIGN KEY IF NOT EXISTS` (MariaDB). Aucune table ni colonne existante modifiée :
   le back de prod (`main`, Cloud Run) continue de fonctionner.
2. Amorce les données, lues dans `rchcu11_tournoi_test` :
   - le compte Google ORGANISATEUR (accès à l'admin) ;
   - les 27 articles de la page Présentation ;
   - l'édition **2026 à `TOURNOI_DEMARRE`** (dates réelles 23–25 mai 2026) → c'est l'édition
     publique : le site affiche toujours les résultats 2026 (TA_* inchangées) ;
   - l'édition **2027 à `CREATION_NOUVEAU_TOURNOI`** (paramètres d'inscription de l'édition
     2027 préparée sur staging) + ses années d'âge → invisible du public, pilotable dans l'admin.
3. Idempotente : sans effet sur une base déjà à jour (vérifié sur la base de test).

Non repris (données de test) : candidatures, dossiers, référentiel d'équipes, format sportif,
jours, activités et créneaux.

## Ordre d'exécution (depuis `back/`)

```bash
# 1. Essai à blanc (lecture seule)
PROD_DATABASE_URL='mysql://…/rchcu11_tournoi?ssl=true' pnpm run db:prod:bascule --target=rchcu11_tournoi

# 2. Exécution : dump JSON des TA_* + ta_partenaires dans out/, puis migration, puis contrôles
PROD_DATABASE_URL='mysql://…/rchcu11_tournoi?ssl=true' pnpm run db:prod:bascule --target=rchcu11_tournoi --apply
```

```bash
# 3. Staging → base prod, avec une ligne de cache distincte de celle du back de prod
az containerapp secret set -n table-de-marque-back -g rg-table-de-marque --secrets mysql-db=rchcu11_tournoi
az containerapp update   -n table-de-marque-back -g rg-table-de-marque --set-env-vars CACHE_SNAPSHOT_KEY=staging
```

Retour arrière de l'étape 3 : `mysql-db=rchcu11_tournoi_test` puis nouvelle révision.
Les tables créées à l'étape 2 peuvent rester en place (le back de prod ne les lit pas).

## Attention une fois staging branché sur la prod

Toute écriture faite sur staging est une écriture en prod, et le site de prod actuel
(Firebase + Cloud Run) lit les mêmes tables `TA_*` : en particulier, **confirmer un planning
depuis staging écrase les résultats 2026** affichés en prod. Faire le dump TA_* depuis l'admin
(« Préparer la nouvelle saison ») avant toute confirmation de planning.
