# Tournoi 3v3

## User Story
En tant que spectateur, je consulte uniquement les matchs 3v3 (surface PG). Si une équipe est sélectionnée, je ne vois que ses matchs et l’autoscroll se centre sur l’ongoing ou le dernier terminé.

## Critères d’acceptation
- Filtres implicites : competition=3v3, surface=PG.
- Filtre équipe optionnel (teamId) : ne renvoyer que ses matchs.
- Autoscroll : ongoing > last finished > first.
- Cartes cliquables → détail match, design aligné 5v5/Planning.
- Cache court, SSE.

## Definition of Done
- TU : filtres competition/surface/teamId, sélection autoscroll, format carte (score/heure).
- E2E : chargement page, autoscroll cohérent, clic match → détail.
- Perf : endpoint matches?competition=3v3&teamId, cache court, SSE.
