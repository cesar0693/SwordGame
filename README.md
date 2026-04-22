# SwordGame

Jeu web fantasy inspiré d'**Ogame** : au lieu de gérer une planète, chaque joueur gère un **héros autour d'un feu de camp**. Mêmes mécaniques de clicker / wait-to-build, mais recentrées sur un personnage personnalisable, son camp, son équipement, ses missions et des combats PvE/PvP résolus automatiquement.

> **Stack** : Angular 21 · NestJS · PostgreSQL + Prisma · Socket.io · Docker Compose
> **Monorepo** pnpm workspaces, types partagés entre front et back via `@swordgame/shared`.

---

## Sommaire

- [Concept de jeu](#concept-de-jeu)
- [Architecture](#architecture)
- [Arborescence](#arborescence)
- [Quickstart](#quickstart)
- [Roadmap par phases](#roadmap-par-phases)
- [Modèle de données (vue d'ensemble)](#modèle-de-données-vue-densemble)
- [Déploiement](#déploiement)

---

## Concept de jeu

Le joueur incarne un héros installé autour d'un **feu de camp** (le hub central de l'UI). Depuis ce hub il peut :

1. **Personnaliser** son héros (classe, apparence, nom).
2. **Gérer son camp** : construire / améliorer des bâtiments (forge, mine, abattage, atelier d'alchimie, tente, autel…). Chaque upgrade coûte des ressources et **prend du temps réel** (mécanique Ogame).
3. **Miner / récolter** des ressources passivement (bois, minerai, cuir, or, gemmes…) selon le niveau des bâtiments.
4. **Partir en mission** : combat PvE **automatique** résolu côté serveur, basé sur les stats, les sorts équipés et un RNG seedé (coups critiques, échecs critiques, esquive). Rewards : XP, loot, ressources.
5. **Faire des mini-jeux / quêtes journalières** pour de l'XP et des récompenses.
6. **Forger et améliorer** son équipement avec des recettes consommant des ressources.
7. **Défier d'autres joueurs** en PvP auto-résolu, avec classement et rewards.

Toutes les actions longues (construction, mission, forge) utilisent le même pattern : un timer serveur **`startAt` / `finishAt`** visible côté client, avec possibilité de réclamer le résultat à l'échéance.

---

## Architecture

```
┌──────────────────────┐        HTTPS / WS        ┌────────────────────────┐
│  Angular 21 (web)    │ ───────────────────────▶ │  NestJS API (api)      │
│  - standalone        │        JWT access        │  - REST + Socket.io    │
│  - signals           │      + HttpOnly refresh  │  - auth / users /      │
│  - new control flow  │                          │    heroes / resources /│
│                      │                          │    buildings / missions│
└──────────────────────┘                          │    combat / pvp / forge│
                                                  └──────────┬─────────────┘
                                                             │ Prisma
                                                             ▼
                                                  ┌────────────────────────┐
                                                  │   PostgreSQL 16        │
                                                  └────────────────────────┘
```

**Pourquoi NestJS ?**
- TypeScript de bout en bout → partage des DTO et enums avec Angular via `@swordgame/shared`.
- Architecture modulaire claire (modules par domaine métier).
- Guards / interceptors / pipes natifs pour JWT, validation, gestion d'erreurs.
- Socket.io intégré via `@nestjs/websockets` pour les notifications temps réel.
- Se conteneurise en une image Node légère, déploiement trivial.

**Pourquoi Postgres + Prisma ?**
- Migrations versionnées, schéma typé, `prisma studio` pour explorer la DB.
- Postgres tient très largement la charge d'un jeu de ce type et s'auto-héberge partout.

**Combat automatique** : résolu intégralement côté serveur. Une mission lancée à `t0` a son issue **calculable à t0** (seed RNG stocké + stats figées), puis jouable en "replay" côté client comme une animation. Empêche toute triche et rend l'affichage indépendant du résultat.

---

## Arborescence

```
swordgame/
├── apps/
│   ├── api/                     # NestJS backend
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── auth/            # JWT login/register
│   │   │   ├── users/
│   │   │   ├── heroes/
│   │   │   ├── prisma/
│   │   │   └── common/
│   │   ├── Dockerfile
│   │   └── package.json
│   └── web/                     # Angular 21 frontend
│       ├── src/
│       │   ├── main.ts
│       │   ├── index.html
│       │   ├── styles.scss
│       │   └── app/
│       │       ├── app.component.ts
│       │       ├── app.config.ts
│       │       ├── app.routes.ts
│       │       ├── core/        # services, interceptors, guards
│       │       └── features/
│       │           ├── auth/
│       │           └── campfire/
│       ├── Dockerfile
│       ├── nginx.conf
│       ├── angular.json
│       └── package.json
├── packages/
│   └── shared/                  # types / enums / DTO partagés
│       ├── src/
│       └── package.json
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── .env.example
└── README.md
```

---

## Quickstart

### Prérequis
- Node.js >= 20.11
- pnpm >= 9 (`corepack enable` puis `corepack prepare pnpm@latest --activate`)
- Docker + Docker Compose

### 1. Installation
```bash
cp .env.example .env
pnpm install
```

### 2. Base de données (Docker)
```bash
docker compose up -d postgres
pnpm db:migrate          # crée la DB + applique les migrations
pnpm db:generate         # génère le client Prisma
```

### 3. Dev
Deux terminaux :
```bash
pnpm dev:api             # http://localhost:3000
pnpm dev:web             # http://localhost:4200
```

### 4. Stack complète en Docker
```bash
docker compose up --build
# web : http://localhost:4200
# api : http://localhost:3000
```

---

## Roadmap par phases

Chaque phase est un lot livrable indépendant. Les phases **0** et **1** sont posées par ce squelette ; on implémentera les suivantes progressivement.

### Phase 0 — Fondations (ce commit)
- [x] Monorepo pnpm, TS strict, ESLint/Prettier.
- [x] NestJS + Prisma + Postgres, schéma couvrant toutes les features à venir.
- [x] Angular 21 standalone + routing + auth flow.
- [x] Package `shared` (DTO, enums).
- [x] Docker Compose (postgres + api + web).
- [x] Auth JWT (register / login / refresh / me).
- [x] Écran "feu de camp" (hub) placeholder.

### Phase 1 — Scène du feu de camp & héros
- [x] Scène immersive plein écran : forêt + ciel comme décor, feu de camp animé au centre (flamme qui vacille), héros placé à côté qui regarde le feu.
- [x] HUD : nom / classe / niveau / barre d'XP en haut-gauche.
- [x] Dock d'actions en bas ouvrant des panneaux modaux **par-dessus** la scène (fenêtres centrées, scène visible derrière).
- [x] Panneau "Profil" complet (stats détaillées).
- [x] Création du héros (nom, classe Guerrier/Mage/Rôdeur, apparence) quand aucun héros n'existe, dans le même style visuel.
- [x] Tous les assets sont des **placeholders SVG** remplaçables sans toucher au code (voir `apps/web/public/assets/placeholders/`).

### Phase 2 — Compagnons, marché et connexion quotidienne ✅
Au lieu de bâtiments, on débloque **des compagnons** qui s'installent autour du feu et travaillent pour le héros. Chacun a un rôle économique, un niveau, un équipement et des **arbitrages forts** (on ne peut pas tout maximiser).

| Compagnon | Rôle principal | Inputs | Outputs |
|-----------|----------------|--------|---------|
| Mineur | extrait les minerais | outils (pioche) | `IRON`, puis `COPPER`, `SILVER`, `GOLD`, `GEM` débloqués par paliers |
| Bûcheron | coupe le bois | outils (hache) | `WOOD`, puis essences spéciales |
| Paysan | cultive les champs | graines (loot) | `WHEAT`, `FLOUR` |
| Récolteur | cueille les plantes | — | `HERB`, herbes spéciales |
| Alchimiste | craft potions temporaires | `HERB` + loot | potions heal/mana/buff (durée limitée) |
| Boulanger | cuisine pour la vie max | `FLOUR` du Paysan | pain (regen HP hors combat, +HP max temporaire) |
| Forgeron | forge/améliore l'équipement | `IRON`/`WOOD`/`LEATHER` | armes, armures, upgrade d'items |

**Progression en deux couches** :

1. **Déblocages automatiques** : chaque compagnon a plusieurs "tracks" (ressources) qui se débloquent à des niveaux fixes. Les tracks tardives sont **plus lentes et moins abondantes** de base (équilibrage assumé).
   Exemple Mineur :
   - Niv 1 : IRON (60s / 8)
   - Niv 3 : COPPER (100s / 5)
   - Niv 5 : SILVER (180s / 3)
   - Niv 7 : GEM (300s / 1)

2. **Points de compétence** : à chaque niveau gagné, le compagnon reçoit **1 point**. Le joueur le dépense sur **une track précise** avec un seul arbitrage binaire :
   - **+ Quantité** : +20 % de rendement par cycle (additif, cap à 5×).
   - **− Temps** : −10 % du temps de cycle (additif, plancher 5× vitesse).

   Les points peuvent être dépensés plusieurs fois sur la même track, sur la même axe. Le joueur peut aussi **diversifier** entre plusieurs minerais.

**Active track** : à tout moment, un compagnon travaille sur **une seule track** à la fois. Le joueur change via le sélecteur du panneau Camp (seulement à l'arrêt). L'intérêt : même si COPPER produit en base 5 par cycle, un joueur qui y dépense 8 points de quantité extrait 21/cycle, à comparer avec de l'IRON de base à 8. Personne ne peut tout max : chaque point dépensé sur COPPER-quantité est un point perdu pour IRON-vitesse.

**Pourquoi c'est stable** (inspiré de RuneScape / Melvor Idle / Factorio) :
- Les tracks tardives valent cher à l'unité (temps de cycle plus long) mais les crafts aval en demandent spécifiquement (Forgeron tier 2+ a besoin de COPPER ou SILVER).
- Les caps (×5 qty, ×5 vitesse max) bornent l'inflation de production.
- Le marché régule la valeur relative : un joueur spécialisé GEM peut vendre cher aux autres.

**Boucle économique** :
- Un compagnon travaille en continu tant qu'il a ses consommables (énergie/outils).
- Les outils s'usent : les améliorer coûte des ressources (économie circulaire).
- Le héros peut ramener du loot de mission qui sert de catalyseur pour des recettes (l'Alchimiste a besoin d'un œil de gobelin rare pour la potion X…).

**Modèle de données** (livré dans ce commit) :
- `Companion` : rôle, niveau, état (`LOCKED`/`IDLE`/`WORKING`), `activeTrack`, `skillPointsUnspent`, `cyclesCompleted`, durabilité, timers de cycle.
- `CompanionSkillSpend` : `{ trackCode, axis: QUANTITY | SPEED }`. Un point dépensé = une ligne.
- Catalogue statique (rôles, tracks, coûts, temps de base) dans `packages/shared/src/companions.ts`.
- 14 `ResourceType` : `GOLD`, tiers minérales (`IRON` → `GEM`), tiers bois (`WOOD` → `IRONWOOD`), céréales, plantes, cuir.

**Règles livrées dans ce commit** :
- Déblocages compagnons : Mineur/Bûcheron dès Niv héros 1, Paysan/Récolteur Niv 3, Alchimiste/Boulanger Niv 5, Forgeron Niv 7.
- Niveaux compagnon : 5 / 12 / 22 / 35 / 55 / 80 / 110 cycles cumulés, puis +30 par niveau.
- Chaque level-up = +1 point de compétence dépensable sur n'importe quelle track débloquée.
- Plafond hors-ligne : **12 cycles** accumulés pendant la déconnexion.
- Outils s'usent à 2/cycle, plancher 0 bloque le démarrage (réparation en Phase 3).
- Cumul des buffs de potions (à venir) : stats différentes = cumul, même stat = plus fort écrase.

#### Marché entre joueurs

Livré dans ce commit. Deux modes :

- **Achat immédiat** : une offre à prix fixe, n'importe qui achète instantanément.
- **Enchère** : prix de départ + durée (1h / 8h / 24h) + éventuel "achat direct" (buyout). Les enchères remboursent automatiquement le précédent plus-offrant ; un bid atteignant le buyout conclut la vente.

**Règles anti-inflation** :
- Taxe de maison de **5 %** sur toute vente (sink d'or).
- L'or ne peut pas être mis en vente sur le marché (évite les boucles de blanchiment).
- Les ressources sont escrow-ées à la création de l'offre → pas de double-vente possible.
- Annulation possible seulement avant la première enchère (pour les auctions).
- Expiration automatique ; les enchères avec un meilleur offrant règlent à l'expiration (transfert + taxe). Les autres remboursent le vendeur.

**Modèle de données** : `MarketListing` + `MarketBid` (ajoutés au schéma).

#### Récompense de connexion quotidienne

Livré dans ce commit. Streak basé sur le jour UTC :
- Jour 1 : +20 or, +10 par jour supplémentaire, **plafonné à Jour 7 (+80)**.
- Streak cassé (plus de 24h sans claim) → retour à 0.
- Panneau s'ouvre automatiquement à la première connexion du jour si un claim est disponible.

### Phase 3 — Inventaire & équipement ✅
Livré dans ce commit :
- **Items d'équipement** sur 7 slots (`WEAPON`, `OFFHAND`, `HELMET`, `ARMOR`, `BOOTS`, `RING`, `AMULET`) avec 5 raretés (`COMMON` → `LEGENDARY`).
- **Génération par le Forgeron** : chaque cycle de `IRON_GEAR` / `COPPER_GEAR` / `SILVER_GEAR` produit 1 item roulé aléatoirement (slot + rareté pondérée 90/8/1.5/0.4/0.1%, bonus scalés par tier × rareté).
- **Slots autorisés par type de bonus** : une arme roll attaque/crit/vitesse, une armure roll PV/déf/esquive, etc.
- **Stats effectives** : le Hero DTO expose maintenant `stats` (base) **et** `effectiveStats` (base + équipement). Le panneau Profil affiche les trois colonnes (Base / Bonus / Effectif).
- **Panneau Inventaire** : vue équipés par slot + sac avec équiper/déséquiper/jeter. Équiper dans un slot déjà occupé déséquipe l'ancien automatiquement.
- **Réparation des outils** : bouton sur chaque carte de compagnon. Coût = `ceil(missing_durability / 10)` en fer.
- **ItemKind** : prêt pour les consommables (potions/pain) ; génération réelle et effets en Phase 4.

### Phase 4 — Missions & combat PvE
- Catalogue de missions (difficulté, durée, récompenses attendues).
- Combat auto résolu server-side : seed RNG, tours simulés, log d'actions.
- XP, level-up (courbe logarithmique), points de stats à dépenser.

### Phase 5 — Forge & amélioration
- Recettes (inputs : ressources + éventuellement item) → item de sortie.
- Amélioration d'un item existant : +1, +2… avec taux d'échec croissant et coût en gems.

### Phase 6 — Sorts
- Sorts par classe, appris via level-up ou quêtes.
- Jusqu'à N sorts équipables → entrent dans la boucle de combat (cooldown, coût MP).

### Phase 7 — PvP
- Classement Elo.
- Défi d'un joueur : combat auto avec ses stats à l'instant T.
- Rewards de saison, cooldown entre défis.

### Phase 8 — Quêtes journalières & mini-jeux
- Reset UTC quotidien (connexion quotidienne déjà livrée en Phase 2).
- Mini-jeux (pile-ou-face enchaîné, memory, dés) récompensant XP/or.

### Phase 9 — Polish
- Notifications temps réel (Socket.io) : mission finie, attaqué en PvP.
- Anti-cheat : toute action mutante passe par un service qui recalcule la production et applique les règles.
- I18n FR/EN.

---

## Modèle de données (vue d'ensemble)

Le schéma Prisma de `apps/api/prisma/schema.prisma` contient **dès la phase 0** les tables nécessaires aux phases 1-4 pour éviter des migrations invasives plus tard. Tableau de synthèse :

| Table            | Rôle                                                                   |
|------------------|------------------------------------------------------------------------|
| `User`           | compte joueur (email, password hash, refresh token hash)               |
| `Hero`           | 1 héros / user : nom, classe, level, xp, stats brutes, apparence JSON  |
| `Resource`       | inventaire de ressources du héros (quantités par type)                 |
| `Building`       | bâtiment du camp avec niveau et timer d'upgrade                        |
| `Item`           | item possédé (rareté, stats, slot, +upgrade level)                     |
| `EquippedItem`   | liens "slot → item" pour le héros                                      |
| `Mission`        | catalogue des missions PvE (template)                                  |
| `MissionRun`     | instance lancée par un héros avec `startAt`, `finishAt`, seed, outcome |
| `Spell`          | catalogue des sorts                                                    |
| `HeroSpell`      | sorts appris / équipés                                                 |
| `PvpMatch`       | résultat d'un combat PvP                                               |
| `DailyQuest`     | état des quêtes journalières                                           |

---

## Déploiement

### Option la plus simple — un VPS avec Docker
```bash
scp .env user@server:/srv/swordgame/.env
rsync -av --exclude node_modules . user@server:/srv/swordgame/
ssh user@server 'cd /srv/swordgame && docker compose up -d --build'
```
Derrière un reverse proxy Caddy (TLS auto) ou Nginx, on expose `web` sur `:443` et `api` sur `/api` (ou sous-domaine).

### Plateformes managées
- **Railway / Render / Fly.io** : chaque service (`api`, `web`, `postgres`) devient un service de la plateforme avec son Dockerfile. Le même `docker-compose.yml` sert de documentation.
- **Vercel pour le front + Railway pour l'api/db** : faisable aussi, mais CORS à configurer (`CORS_ORIGINS`).

---

## Images et assets

Toutes les images sont des **placeholders SVG / PNG** dans `apps/web/src/assets/placeholders/`. Quand tu fourniras les assets définitifs, il suffira de remplacer les fichiers (mêmes noms) ou d'utiliser la nomenclature déjà posée.

## Scripts utiles

| Commande              | Effet                                              |
|-----------------------|----------------------------------------------------|
| `pnpm dev:api`        | API NestJS en watch                                |
| `pnpm dev:web`        | Angular en mode serve                              |
| `pnpm db:migrate`     | Crée / applique une migration Prisma               |
| `pnpm db:studio`      | UI web pour explorer la DB                         |
| `pnpm docker:up`      | Démarre toute la stack                             |
| `pnpm build`          | Build tous les workspaces                          |
| `pnpm lint`           | Lint tous les workspaces                           |
