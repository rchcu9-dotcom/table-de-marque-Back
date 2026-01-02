# ADR – Cache & SSE

## Contexte
- Pages critiques (matches, challenge) doivent se rafraîchir rapidement (scores) sans recharger tout le front.
- Volumétrie : peu de données, mais fréquentes mises à jour de score/état.
- Environnements : staging/prod (Cloud Run/Azure), latences réseau variables, front Vite.

## Options
- A. Cache HTTP court (10–30s) pour les endpoints volatils (matches/perfs), long (5–15 min) pour listes stables (équipes, classements). SSE pour pousser les updates.
- B. Aucun cache, polling fréquent.
- C. Websocket full-duplex.

## Décision
- Retenir A : Cache court pour endpoints volatils (matches, performances), cache long pour listes stables (équipes, classements). SSE pour propager les scores/états sans reload.

## Détails
- Cache court : 10–30s (matches, performances challenge).
- Cache long : 5–15 min (équipes, classements) ; pré-agrégation recommandée pour standings.
- SSE : sur /matches/stream et (optionnel) /challenge/stream si besoin ; côté front, pas d’auto-refresh forcé.
- Filtrage côté serveur (teamId, competition, day) pour réduire le payload.

## Impacts
- Doit être documenté dans les endpoints (headers cache-control).
- Front : garder la logique SSE existante et ne pas déclencher de reload inutile.
- Tests : vérifier que les endpoints respectent les TTL, SSE diffuse correctement les updates.
