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

### Phase 1 — Héros & personnalisation
- Création d'un héros (nom, classe : Guerrier / Mage / Rôdeur, apparence).
- Stats de base par classe (HP, MP, ATK, DEF, SPD, CRIT%, CRIT_FAIL%, DODGE%).
- Écran "Feu de camp" avec portrait du héros, stats, et navigation.

### Phase 2 — Ressources & camp
- Ressources : `WOOD`, `IRON`, `LEATHER`, `HERB`, `GOLD`, `GEM`.
- Bâtiments : `WOODCUTTER`, `MINE`, `TANNERY`, `HERBALIST`, `FORGE`, `ALTAR`, `TENT`.
- Génération passive : taux = f(niveau du bâtiment).
- File d'upgrade avec `startAt / finishAt`, un seul upgrade en parallèle au démarrage.

### Phase 3 — Inventaire & équipement
- Items : `WEAPON`, `OFFHAND`, `HELMET`, `ARMOR`, `BOOTS`, `RING`, `AMULET`.
- Raretés : `COMMON`, `UNCOMMON`, `RARE`, `EPIC`, `LEGENDARY`.
- Slots d'équipement → modifie les stats calculées du héros.

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
- Reset UTC quotidien.
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
