# Deploy — SwordGame sur Linux (Bazzite OS) avec Docker

Ce guide suppose Bazzite OS (Fedora Atomic) avec `docker` et `git` installés. Ça marche à l'identique sur n'importe quel Linux avec Docker Engine + Compose v2.

## Prérequis

```sh
docker --version          # >= 24
docker compose version    # v2.x
git --version
```

Sur Bazzite, Docker est généralement déjà là. Si `docker` pointe sur Podman et que tu as un souci, installe Docker Engine avec `rpm-ostree install docker docker-compose` puis redémarre, OU utilise les commandes `podman`/`podman-compose` directement (syntaxe identique).

Si le daemon n'est pas démarré :
```sh
sudo systemctl enable --now docker
# Bazzite par défaut nécessite sudo, tu peux ajouter ton user au groupe docker :
sudo usermod -aG docker $USER
newgrp docker
```

## 1. Cloner le repo

```sh
git clone <ton-url-git> swordgame
cd swordgame
git checkout claude/ogame-project-setup-H0oAJ     # ou main quand tu auras mergé
```

## 2. Configurer l'environnement

```sh
cp .env.example .env
```

Ouvre `.env` et **change au minimum** les deux secrets JWT (sinon sécurité nulle) :

```
JWT_ACCESS_SECRET=<génère un string aléatoire, ex: openssl rand -hex 32>
JWT_REFRESH_SECRET=<un autre string aléatoire>
```

Pour un déploiement local (toi seul qui joues), les valeurs par défaut des autres champs (ports, Postgres user/password) conviennent. Si tu exposes publiquement, change aussi `POSTGRES_PASSWORD`.

Si tu veux exposer le serveur sur le LAN, mets `CORS_ORIGINS=http://<ip-machine>:4200` (ou un domaine) dans `.env`.

## 3. Build et démarrer la stack

```sh
docker compose build
docker compose up -d
```

Ordre de démarrage automatique : `postgres` → (healthcheck ok) → `api` → `web`.

Au premier démarrage, l'API **pousse le schéma** dans Postgres avec `prisma db push` (idempotent, pas besoin de fichiers de migration). Le serveur écoute ensuite sur `:3000`.

Vérifie :

```sh
docker compose ps                          # tous UP + healthy pour postgres
curl http://localhost:3000/api/health      # { "status":"ok", ... }
```

Ouvre le jeu : <http://localhost:4200>

## 4. Logs et debug

```sh
docker compose logs -f api      # logs du backend en live
docker compose logs -f web      # nginx + angular
docker compose logs postgres    # base de données
```

Si l'API redémarre en boucle, c'est presque toujours un problème de `.env` (DATABASE_URL mal formée) ou Postgres pas encore prêt. Le healthcheck attend déjà la DB, mais tu peux forcer :

```sh
docker compose down
docker compose up -d postgres
# attendre 5s
docker compose up -d
```

## 5. Commandes utiles après

```sh
# Mettre à jour le code
git pull
docker compose build
docker compose up -d                # relance les services qui ont changé

# Inspecter la DB
docker compose exec postgres psql -U swordgame -d swordgame

# Réinitialiser complètement (PERD les données)
docker compose down -v
docker compose up -d --build
```

## 6. Exposer sur le LAN (jouer depuis un autre poste)

Deux options :

**A. Ports bruts** (simple, pour LAN confiance) :

```yml
# docker-compose.yml — ports déjà en 0.0.0.0
# Depuis un autre poste : http://<ip-du-serveur>:4200
```

Et dans `.env` du serveur :
```
CORS_ORIGINS=http://<ip-du-serveur>:4200
API_BASE_URL=http://<ip-du-serveur>:3000
```

Puis `docker compose up -d --build web` pour que le front embarque la nouvelle URL.

**B. Derrière Caddy/Nginx avec TLS** (pour exposition Internet) : documenter à part, pas nécessaire en local.

## 7. Mises à jour du schéma Prisma

Tant qu'on reste en dev avec `db push`, chaque changement de `schema.prisma` se propage au prochain redémarrage de l'api — pas de migration à gérer.

Quand tu voudras passer en vraies migrations versionnées :

```sh
# En local (hors Docker)
pnpm --filter @swordgame/api prisma migrate dev --name phase-X-change
git add apps/api/prisma/migrations
git commit
```

Puis remplace le `CMD` du Dockerfile api par :
```
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/main.js"]
```

## Dépannage

| Symptôme | Cause probable | Fix |
|----------|----------------|-----|
| `Cannot find module '@swordgame/shared'` dans les logs API | shared pas buildé ou symlink cassé | `docker compose build --no-cache api` |
| API redémarre en boucle | `.env` absent ou secrets JWT vides | `cp .env.example .env`, remplir, `docker compose up -d` |
| Login renvoie 401 sur tout | `JWT_ACCESS_SECRET` change entre redémarrages | Mets un secret fixe dans `.env` |
| Port 4200 ou 3000 déjà occupé | autre app qui l'utilise | change `WEB_PORT` / `API_PORT` dans `.env` |
| Angular affiche une page blanche | le build du front pointe sur la mauvaise `API_BASE_URL` | rebuild `web` après avoir mis à jour `.env` |
