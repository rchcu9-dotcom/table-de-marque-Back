# Contrôle des logos d'équipe

Spec : `docs/specs/-nettoyage-des-fichiers-de-logo-contexte-la-gestion-des-fich.md`.

L'URL d'un logo est calculée depuis le nom de l'équipe : `<TEAM_LOGO_BASE_URL>/<slug>.png`
(`slugifyTeamName`, `src/infrastructure/persistence/mysql/mysql-utils.ts`). Un fichier de
`front/public/assets/logos/` n'est donc servi que si son nom est exactement le slug d'un
nom d'équipe.

`controle-logos.ts` compare une liste de noms au dossier et signale :

- les noms **sans fichier** (logo manquant) ;
- les fichiers **sans nom** (orphelins) ;
- les fichiers **identiques** (même empreinte SHA-256).

Il ne supprime et ne renomme rien. Les `git rm` / `git mv` se font à la main dans le dépôt
`front`, un commit par lot.

## Sources de noms

| Option | Source |
|--------|--------|
| `--seed` | `prisma/seed-tournoi-2026.sql` (colonne `EQUIPE` de `ta_equipes`) |
| `--mocks` | `src/hooks/mock-teams.data.ts` (`id`) |
| `--db --target=<base>` | `ta_equipes.EQUIPE` de la base de **test** (garde-fou ADR-002) |
| `--noms=<source>:<fichier.json>` | fichier de noms, répétable |

Un fichier de noms est un tableau JSON de chaînes ou d'objets `{ "nom": "…" }` (voir
`noms.exemple.json`). Le fichier de correspondance nom court → nom complet de
`scripts/equipes-referentiel/` convient tel quel pour `--noms=liste:…`.

## Prod

Le script ne se connecte jamais à la prod. Les noms de prod sont exportés par une requête
en lecture seule, puis passés en fichier (`--noms=prod:<fichier.json>`) :

```sql
SELECT EQUIPE FROM ta_equipes ORDER BY EQUIPE;
```

Contrôle des liens enregistrés au référentiel (staging et prod) — aucune valeur ne doit
pointer vers un fichier renommé ou supprimé :

```sql
SELECT id, nom, logo_url FROM insc_equipes_referentiel WHERE logo_url IS NOT NULL;
```

## Séquence avant / après

```bash
# Avant toute suppression
pnpm run logos:controle --seed --mocks --db --target=rchcu11_tournoi_test --instantane=avant.json

# Inventaire à coller dans le fichier de suivi (lot B, avec la liste)
pnpm run logos:controle --seed --mocks --db --target=rchcu11_tournoi_test \
  --noms=liste:<liste.json> --noms=prod:<prod.json> --inventaire

# Après
pnpm run logos:controle --seed --mocks --db --target=rchcu11_tournoi_test --avant=avant.json
```

Attendu après nettoyage : aucun logo perdu, aucun fichier ajouté, aucun contenu modifié.
`--strict` renvoie le code 1 s'il reste un manquant, un orphelin ou un doublon.

Les instantanés sont écrits dans `out/` (non versionné).
