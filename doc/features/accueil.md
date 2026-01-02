# Accueil

## User Story
En tant que spectateur, je vois le bloc Momentum GG (3 matchs centraux), le bloc Équipes (16 cartes), et les blocs PG (3v3/Challenge) si activés, pour accéder vite aux infos clés.

## Critères d’acceptation
- Momentum affiche 3 matchs (ongoing sinon last finished sinon first) surface=GG, compétition 5v5.
- Bloc Équipes liste les 16 équipes (nom court, logo), clic → page équipe.
- Si équipe sélectionnée, son logo apparaît dans le header global ; clic logo peut désélectionner.
- Performant (cache court matchs, long équipes).

## Definition of Done
- TU : sélection trio momentum (ongoing > finished > first), mapping équipe (nom court/logo), état sélection équipe (store).
- E2E : chargement page sans erreur, clic équipe → navigation détail, changement équipe dans header.
- Perf : cache appliqué (matchs court, équipes long), appels filtrés (surface/competition).
- Accessibilité : focusable, textes lisibles.
