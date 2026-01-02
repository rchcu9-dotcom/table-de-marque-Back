# Planning

## User Story
En tant que spectateur, je consulte la liste chronologique des matchs avec filtres (équipe, compétition, jour) et scroll ancré sur le match en cours ou dernier terminé.

## Critères d’acceptation
- Filtres multi-sélection : compétitions (5v5, 3v3, Challenge), jours, équipe (optionnel).
- Liste filtrée/triée chronologiquement, autoscroll sur ongoing sinon last finished.
- Cartes cliquables → détail match/challenge.
- Cache court pour matchs, SSE pour updates score.

## Definition of Done
- TU : filtre par équipe/jour/compétition, sélection autoscroll, sérialisation des query params (si persistés).
- E2E : charge sans erreur, filtres visibles, clic match → page détail, scroll positionné.
- Perf : endpoint paginé/filtré (teamId/competition/day), cache court, SSE compatible.
