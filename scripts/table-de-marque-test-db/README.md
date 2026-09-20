# Rattrapage de schéma « table de marque » sur la base de TEST

Contexte : `docs/specs/dcision-pas-acceptable-on-laisse-en-ltat-car-risque-limit-pa.md` ;
garde-fou : `docs/adr/ADR-002-garde-fou-base-test-scripts-sql.md`.

**Ces scripts n'agissent que sur une base dont le nom se termine par `_test`.** Ils lisent
`back/.env.local` (sans écraser un `DATABASE_URL` déjà exporté) et exigent `--target=<base>`.
Aucun identifiant n'est affiché ni journalisé.

## Ordre d'exécution (depuis `back/`)

```bash
# 1. Constat, lecture seule (schéma attendu + inventaire des autres migrations)
pnpm run db:test:tdm:verify -- --target=rchcu11_tournoi_test

# 2. Essai à blanc : garde-fou, version du serveur, liste des instructions — n'écrit rien
pnpm run db:test:tdm:apply -- --target=rchcu11_tournoi_test --dry-run

# 3. Rejeu réel (SQL versionné, idempotent) — seulement si l'étape 1 signale un objet manquant
pnpm run db:test:tdm:apply -- --target=rchcu11_tournoi_test
#    Si « ADD COLUMN IF NOT EXISTS » est refusé (MySQL 8) : ajouter --compat-mysql8

# 4. Test fonctionnel (match live → but → pénalité → suppression de but), avec nettoyage
pnpm run db:test:tdm:smoke -- --target=rchcu11_tournoi_test
```

Codes retour : `0` succès, `1` échec/écart, `2` test fonctionnel non exécutable (pré-requis absents).

## Lecture des résultats de `verify`

- `[OK]` conforme à `migration.sql` ; `[KO]` écart bloquant ; `[WARN]` écart documenté non bloquant
  (FK supplémentaires issues de `schema.prisma`).
- L'inventaire final (« présente / partielle / absente / non vérifiable ») est un **signalement** :
  ces scripts ne rejouent que la migration table de marque.

## Rejeu après rechargement de `ta_equipes`

L'import externe recrée `ta_equipes` et peut supprimer `EQUIPE_REF_ID` : relancer `verify`, puis
`apply` si la colonne manque (idempotent).

## Retrait (test uniquement, sur confirmation explicite)

`DROP TABLE` de `match_penalites`, `match_buts`, `match_live`, `match_types_penalite` (dans cet
ordre) puis `ALTER TABLE ta_equipes DROP COLUMN EQUIPE_REF_ID`. Aucun script fourni volontairement.

## Rapports

`apply` écrit un rapport JSON sans secret dans `scripts/table-de-marque-test-db/out/` (ignoré par git).
