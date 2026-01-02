# Tournoi 5v5

## User Story
En tant que spectateur, je vois momentum 5v5, les classements par poule/carré, et les matchs groupés par jour. Si une équipe est sélectionnée, seuls les blocs la contenant s’affichent, et l’autoscroll va sur le match en cours ou dernier joué.

## Critères d’acceptation
- Momentum : surface=GG, competition=5v5, 3 matchs centrés sur ongoing.
- Blocs J1/J2/J3 : classements + matchs de la poule/carré ; filtres jour via badges.
- Filtre équipe : n’affiche que les blocs où l’équipe est présente ; autoscroll sur le match en cours de cette équipe ou dernier.
- Cartes match (fond diagonal, logos, score/heure alignés) cliquables.
- Cache court matchs, cache long classements, SSE pour scores.

## Definition of Done
- TU : sélection momentum (ongoing > finished > first), filtrage par équipe sur blocs, alignement jour/match en cours, rendering carte (score vs heure).
- E2E : chargement page, filtres jour, clic match → détail, autoscroll positionné.
- Perf : endpoints découpés (matches?competition=5v5&teamId&day, standings?teamId&phase), cache, SSE compatible.
