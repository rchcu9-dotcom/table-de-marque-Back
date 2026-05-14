# Détail match

## User Story
En tant que spectateur, je veux la fiche match : header avec logos/score/status, slider des matchs de la même poule/carré, classement de la poule du match, navigation vers équipes.

## Critères d’acceptation
- Header figé (logo A/B, status Terminé/En cours/À venir), fonds diagonaux appliqués, clic logos/nom → page équipe.
- Slider des matchs de la poule : mêmes cartes que planning (fond diagonal, score/heure), cliquables.
- Classement poule du match : cohérent avec le match (pouleName/code alignés).
- Status badges harmonisés, pas d’auto-refresh front (SSE côté back).

## Definition of Done
- TU : cohérence poule entre slider/classement, status mapping, liens équipes/matchs.
- E2E : navigation planning/5v5 → match détail, slider/classement visibles, links OK.
- Perf : endpoint match detail fournit poule/code, standings de la poule, cache court; SSE updates.
