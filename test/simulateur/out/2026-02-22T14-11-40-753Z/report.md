# Rapport simulateur tournoi

- Mode: dry-run
- Temps: immediate
- J1/J2/J3: 2026-02-22 / 2026-02-23 / 2026-02-24
- Remap SQL dates: true

## Statistiques
- Equipes: 16
- Joueurs: 231
- Matchs: 64
- Matchs termines: 64
- Tentatives challenge: 693
- Evenements journalises: 1476
- Ecritures simulees: 1288

## Nomenclature J2 (GROUPE_NOM)
- Or A
- Or B
- Argent C
- Argent D

## Volumes 5v5
- J1: 24
- J2: 24

## Audit challenge J1
- team=1 start=2026-02-22T08:30:00.000Z source=sql raw=2026-05-23 09:30:00
- team=2 start=2026-02-22T09:10:00.000Z source=sql raw=2026-05-23 10:10:00
- team=3 start=2026-02-22T09:50:00.000Z source=sql raw=2026-05-23 10:50:00
- team=4 start=2026-02-22T10:30:00.000Z source=sql raw=2026-05-23 11:30:00
- team=5 start=2026-02-22T11:10:00.000Z source=sql raw=2026-05-23 12:10:00
- team=6 start=2026-02-22T11:50:00.000Z source=sql raw=2026-05-23 12:50:00
- team=7 start=2026-02-22T12:30:00.000Z source=sql raw=2026-05-23 13:30:00
- team=8 start=2026-02-22T13:10:00.000Z source=sql raw=2026-05-23 14:10:00
- team=9 start=2026-02-22T13:50:00.000Z source=sql raw=2026-05-23 14:50:00
- team=10 start=2026-02-22T14:30:00.000Z source=sql raw=2026-05-23 15:30:00
- team=11 start=2026-02-22T15:10:00.000Z source=sql raw=2026-05-23 16:10:00
- team=12 start=2026-02-22T15:50:00.000Z source=sql raw=2026-05-23 16:50:00
- team=13 start=2026-02-22T16:30:00.000Z source=sql raw=2026-05-23 17:30:00
- team=14 start=2026-02-22T17:10:00.000Z source=sql raw=2026-05-23 18:10:00
- team=15 start=2026-02-22T17:50:00.000Z source=sql raw=2026-05-23 18:50:00
- team=16 start=2026-02-22T18:30:00.000Z source=sql raw=2026-05-23 19:30:00

## SQL date remap
- enabled: true
- source: 2026-05-23 | 2026-05-24 | 2026-05-25
- target: 2026-02-22 | 2026-02-23 | 2026-02-24
- 2026-05-23 -> 2026-02-22
- 2026-05-24 -> 2026-02-23
- 2026-05-25 -> 2026-02-24

## Note
- Dry-run: aucune ecriture DB reelle.

## Run metrics
- sessionExecutedWrites: 0
- sessionFailedWrites: 0
- sessionRetries: 0
- skippedBecauseAlreadyExecuted: 0
- totalExecutedWritesIncludingCheckpoint: 0
- totalFailedWritesIncludingCheckpoint: 0
- totalRetriesIncludingCheckpoint: 0
- runDurationMs: 174
- dbTarget: dry-run
- backupFile: n/a
- checkpointUsed: false
