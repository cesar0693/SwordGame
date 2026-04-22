# Placeholders

Tous ces fichiers sont des **placeholders** faits pour être remplacés sans toucher au code.
Garde les mêmes noms/chemins et ça marche.

## Actuellement en place

- `favicon.svg` — icône d'onglet.
- `forest-bg.svg` — décor plein écran (forêt + ciel). Chargé en `background-image` dans
  `apps/web/src/app/features/campfire/scene/campfire-scene.component.ts`.

## Sprites intégrés au code (à externaliser quand tu auras les vrais)

Les deux sprites animés ci-dessous sont actuellement des **SVG inline** pour pouvoir
animer la flamme/respiration en CSS. Quand tu auras des vrais sprites :

- **Feu animé** : `fire-sprite.component.ts`
  Remplace le bloc `<svg>` par un `<img src="assets/placeholders/fire.png">` +
  animation `background-position` avec `steps(N)` si c'est une sprite-sheet.

- **Héros** : `hero-sprite.component.ts`
  Même principe — sprite-sheet par classe (WARRIOR/MAGE/RANGER) via
  `hero-<class>.png`, toujours avec la même boîte 120×200.

## À venir (selon la roadmap)

- `companion-<role>.png` — sprites des compagnons (Phase 2).
- `item-<slot>-<rarity>.png` — icônes d'équipement (Phase 3).
- `enemy-<code>.png` — portraits d'ennemis de missions (Phase 4).
