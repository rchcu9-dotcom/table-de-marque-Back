# Détail équipe

## User Story
En tant que spectateur, je vois la fiche équipe : momentum/présence, prochains & derniers matchs, effectif complet, classements/poules liées, surbrillance de l’équipe sur les scores.

## Critères d’acceptation
- Nom court + logo, navigation depuis l’accueil/planning. Logo sélectionné reflété dans le header global.
- Prochains/Derniers matchs : cartes fines (logo A/B, score/heure alignés), score coloré selon victoire/défaite pour l’équipe de la page.
- Effectif : liste des 15 joueurs (nom/prénom/numéro/poste), logos équipe.
- Classements liés (par jour/poule/carré) + highlights joueurs challenge (2 meilleurs perfs par atelier si dispo).
- Filtres/selection équipe n’altèrent pas les autres équipes (bloc Équipes accueil ne change plus la sélection).

## Definition of Done
- TU : mapping données équipe, coloration score vs team, effectif (nom+poste+numéro), classes/links vers /teams/:id.
- E2E : navigation accueil → équipe, blocs visibles, cartes cliquables → match détail, effectif complet.
- Perf : endpoints filtrés par teamId (matches, standings, players), cache court matchs/long équipe.
