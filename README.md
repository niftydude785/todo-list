# Todo App

Application web full-stack de gestion de tâches avec authentification par email.

**Stack :** Vue 3 (Vite) · Node.js/Express · PostgreSQL (Supabase) · Brevo (emails) · Render (backend) · Vercel (frontend)

---

## Fonctionnement du site

### Accès public
La liste des tâches est visible par tous sans connexion. Chaque tâche affiche :
- Une image (optionnelle, stockée en base64)
- Un texte descriptif
- Une date d'échéance avec le préfixe "Échéance :"
- Un badge de couleur choisi par l'auteur
- Un indicateur visuel : **vert "à faire"** si la date n'est pas passée, **rouge "dépassé"** sinon

Les tâches sont triées par date d'échéance croissante (les plus proches en premier). Les tâches sans date apparaissent en dernier.

Des filtres permettent d'afficher les tâches par statut (toutes / à faire / dépassées) et par couleur.

### Inscription
1. L'utilisateur remplit email + mot de passe (min. 6 caractères)
2. Le backend crée le compte en base avec le mot de passe haché (bcrypt)
3. Un email de confirmation est envoyé via Brevo
4. L'utilisateur clique le lien → compte activé → connecté automatiquement pour 7 jours

### Connexion
L'utilisateur entre son email + mot de passe. Le backend vérifie le hash bcrypt et retourne un JWT valable 7 jours, stocké dans le `localStorage` du navigateur.

### Actions authentifiées
Une fois connecté, l'utilisateur peut :
- Ajouter une tâche (image, texte, date, couleur)
- Supprimer ses propres tâches
- Se déconnecter (suppression du token local)

---

## Sécurité — Explication des mécanismes

### Hachage du mot de passe (bcrypt)

Le mot de passe n'est **jamais stocké en clair**. bcrypt applique :
1. Un **sel aléatoire** unique généré pour chaque utilisateur
2. Un **hachage irréversible** en 12 passes (coût computationnel élevé, résistant aux attaques brute-force)

Le hash stocké en base ressemble à : `$2b$12$...` (inclut le sel et le coût).

Lors de la connexion, bcrypt re-hache le mot de passe fourni avec le sel extrait du hash stocké et compare le résultat.

### Token de vérification d'email

À l'inscription, un UUID aléatoire (`verification_token`) est généré et stocké en base avec une expiration de 24h. Ce token est inclus dans le lien envoyé par email :

```
https://backend.onrender.com/api/auth/verify-email?token=<uuid>
```

Quand l'utilisateur clique :
- Le backend vérifie que le token existe et n'est pas expiré
- Il marque le compte comme `email_verified = TRUE`
- Il supprime le token de vérification de la base
- Il émet un JWT et redirige vers le frontend avec `#auth_token=<jwt>`
- Le frontend extrait le token du hash URL, le stocke dans `localStorage` et connecte l'utilisateur

### JWT (JSON Web Token)

Le JWT est un token signé côté serveur avec `JWT_SECRET`. Il contient :
```json
{ "userId": "uuid...", "email": "user@exemple.com", "iat": 1234567890, "exp": 1234567890 }
```

- **Signé** avec HMAC-SHA256 : toute modification invalide la signature
- **Durée de vie** : 7 jours (`expiresIn: '7d'`)
- **Stocké** dans le `localStorage` du navigateur
- **Transmis** dans chaque requête protégée via l'en-tête HTTP : `Authorization: Bearer <token>`

Le backend vérifie la signature à chaque requête sans consulter la base de données. Il n'y a pas de session côté serveur.

---

## Connexion à la base de données (Supabase/PostgreSQL)

Le backend se connecte à Supabase via le driver `pg` (node-postgres) avec :
- **SSL activé** avec le certificat CA Supabase (`prod-ca-2021.crt`) pour une connexion chiffrée et vérifiée
- **IPv4 forcé** (`family: 4` + flag Node `--dns-result-order=ipv4first`) car Render free tier ne supporte pas IPv6 vers Supabase
- **URL de connexion** : Session pooler Supabase (port 5432 direct)

### Schéma de la base

```sql
users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE,
  password_hash VARCHAR,          -- hash bcrypt du mot de passe
  email_verified BOOLEAN,         -- compte activé après clic sur le lien
  verification_token VARCHAR,     -- UUID one-time pour confirmer l'email
  verification_expires_at TIMESTAMP,
  created_at TIMESTAMP
)

todos (
  id UUID PRIMARY KEY,
  user_id UUID → users(id),
  text TEXT,
  image_base64 TEXT,              -- image encodée en base64
  due_date DATE,
  color_status VARCHAR,           -- red | orange | yellow | green | blue | purple
  created_at TIMESTAMP
)
```

---

## Architecture backend (Node.js/Express sur Render)

```
POST /api/auth/register       → création compte + envoi email de confirmation
GET  /api/auth/verify-email   → activation compte + émission JWT → redirect frontend
POST /api/auth/login          → vérification mot de passe → retourne JWT
GET  /api/auth/me             → retourne l'utilisateur courant (vérifie JWT)

GET    /api/todos             → liste toutes les tâches (public)
POST   /api/todos             → crée une tâche (JWT requis)
DELETE /api/todos/:id         → supprime une tâche (JWT requis, propriétaire uniquement)
```

---

## Installation locale

### Prérequis
- Node.js 18+
- Un projet Supabase avec le schéma SQL exécuté (`backend/schema.sql`)
- Un compte Brevo avec un expéditeur vérifié

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Remplir .env avec les vraies valeurs
npm run dev   # port 3001
```

### Frontend

```bash
cd frontend
npm install
# Créer frontend/.env.local :
echo "VITE_API_URL=http://localhost:3001" > .env.local
npm run dev   # port 5173
```

---

## Variables d'environnement (backend)

| Variable | Description |
|---|---|
| `DATABASE_URL` | URL de connexion Supabase (Session pooler, port 5432) |
| `JWT_SECRET` | Clé secrète pour signer les JWT (chaîne aléatoire longue) |
| `BREVO_API_KEY` | Clé API Brevo pour l'envoi d'emails |
| `BREVO_SENDER_EMAIL` | Email expéditeur vérifié dans Brevo |
| `FRONTEND_URL` | URL du frontend (ex: `https://xxx.vercel.app`) |
| `BACKEND_URL` | URL du backend (ex: `https://xxx.onrender.com`) |

---

## Déploiement

### Backend (Render)
1. Connecter le repo GitHub, choisir le dossier `backend` comme root
2. Build command : *(vide)*
3. Start command : `npm start`
4. Ajouter toutes les variables d'environnement dans le dashboard Render

### Frontend (Vercel)
1. Connecter le repo GitHub, choisir le dossier `frontend` comme root
2. Framework : Vite (auto-détecté)
3. Ajouter la variable : `VITE_API_URL=https://ton-backend.onrender.com`

### Base de données (Supabase)
Exécuter le fichier `backend/schema.sql` dans l'éditeur SQL de Supabase.
