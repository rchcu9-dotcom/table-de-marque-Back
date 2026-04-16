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

## Equipes SQL (source of truth)
- 1: Meyrin
- 2: Champigny
- 3: Dammarie
- 4: Angers
- 5: Rennes
- 6: Meudon
- 7: Compiègne
- 8: Neuilly
- 9: Cholet
- 10: Le Havre
- 11: Evry-Viry
- 12: Courbevoie
- 13: Tours
- 14: Valenciennes
- 15: Rouen
- 16: Les Volants

## Data warnings
- Match 71: team A placeholder "pArgent C3Argent D4" resolved via resolved_from_composite:argentc3.
- Match 71: team B placeholder "pArgent D3Argent C4" resolved via resolved_from_composite:argentc4.
- Match 72: team A placeholder "pArgent C1Argent D2" resolved via resolved_from_composite:argentc1.
- Match 72: team B placeholder "pArgent D1Argent C2" resolved via resolved_from_composite:argentc2.
- Match 73: team A placeholder "pOr A3Or B4" resolved via resolved_from_composite:ora3.
- Match 73: team B placeholder "pOr B3Or A4" resolved via resolved_from_composite:ora4.
- Match 74: team A placeholder "pOr A1Or B2" resolved via resolved_from_composite:ora1.
- Match 74: team B placeholder "pOr B1Or A2" resolved via resolved_from_composite:ora2.
- Match 76: team A placeholder "vArgent C3Argent D4" resolved via resolved_from_composite:argentc3.
- Match 76: team B placeholder "vArgent D3Argent C4" resolved via resolved_from_composite:argentc4.
- Match 77: team A placeholder "vArgent C1Argent D2" resolved via resolved_from_composite:argentc1.
- Match 77: team B placeholder "vArgent D1Argent C2" resolved via resolved_from_composite:argentc2.
- Match 78: team A placeholder "vOr A3Or B4" resolved via resolved_from_composite:ora3.
- Match 78: team B placeholder "vOr B3Or A4" resolved via resolved_from_composite:ora4.
- Match 80: team A placeholder "vOr A1Or B2" resolved via resolved_from_composite:ora1.
- Match 80: team B placeholder "vOr B1Or A2" resolved via resolved_from_composite:ora2.

## SQL loader diagnostics
- fiveVFiveSourceRows: 64
- keptByDay: J1=24, J2=24, J3=16
- droppedByReason:

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
- runDurationMs: 190
- dbTarget: dry-run
- backupFile: n/a
- checkpointUsed: false
