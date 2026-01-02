# Challenge individuel

## User Story
En tant que spectateur, je vois Evaluation (Jour1) et Finales (Jour3) du Challenge : Top3 par atelier, listings « Voir tout », filtrables par équipe. SSE/updates reflètent les scores sans reload.

## Critères d’acceptation
- Top3 Vitesse/Tir/Agilité : icône + titre + lien Voir tout, tableau sans titre répété.
- Filtres : équipe globale (filtre les datasets), badges ateliers (montrer/cacher), search joueur/équipe.
- Finales : blocs Quarts/Demis/Finale ; si filtré par équipe, blocs vides non rendus.
- Pages « Voir tout » par atelier : listing complet, recherche, rang visible, icône atelier.
- Cache court perfs, cache long joueurs ; SSE pour mises à jour.

## Definition of Done
- TU : filtrage teamId sur tous datasets (top3, finales, voir tout), rendu conditionnel blocs non vides, rangs/metrics corrects.
- E2E : navigation Challenge → Voir tout ateliers, filtres équipe/atelier/search, absence de blocs vides, clic joueur/équipe ok.
- Perf : endpoints découpés (players?teamId, performances?teamId&atelier), cache court perfs/long players, SSE ready.
