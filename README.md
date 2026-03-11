# Todo App — Full-Stack (Vue 3 + Node.js + Supabase + Resend)

A full-stack todo application with magic-link authentication, per-item images, colour statuses and due-date highlighting.

| Layer     | Technology                      |
|-----------|---------------------------------|
| Frontend  | Vue 3 + Vite                    |
| Backend   | Node.js / Express               |
| Database  | PostgreSQL via Supabase          |
| Email     | Resend (magic-link login)       |
| Hosting   | Frontend: any static host / Render; Backend: Render |

---

## 1. Set up Supabase

1. Create a free account at <https://supabase.com>.
2. Create a new project (choose a region close to you).
3. Wait for provisioning to finish, then open **SQL Editor → New Query**.
4. Paste the contents of `backend/schema.sql` and click **Run**.
5. Go to **Settings → Database** and copy the **Connection string (URI mode)**.
   It looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[REF].supabase.co:5432/postgres
   ```
   You will need this as `DATABASE_URL`.

---

## 2. Configure environment variables

### Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` and fill in every variable:

| Variable         | Where to find it                                      |
|------------------|-------------------------------------------------------|
| `DATABASE_URL`   | Supabase → Settings → Database → URI mode             |
| `JWT_SECRET`     | Run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `RESEND_API_KEY` | Resend dashboard → API Keys                           |
| `RESEND_FROM_EMAIL` | A verified sender address in your Resend account   |
| `FRONTEND_URL`   | `http://localhost:5173` locally, or your deployed URL |
| `BACKEND_URL`    | `http://localhost:3001` locally, or your Render URL   |
| `PORT`           | Leave as `3001` locally (Render sets it automatically)|

### Frontend

Create `frontend/.env.local` (git-ignored by Vite automatically):

```env
VITE_API_URL=http://localhost:3001
```

In production set `VITE_API_URL` to your Render backend URL (e.g. `https://todo-backend.onrender.com`).

---

## 3. Run the backend locally

```bash
cd backend
npm install
npm run dev        # uses nodemon for auto-reload
# or:
npm start          # plain node
```

The server starts on <http://localhost:3001>.
Test with: `curl http://localhost:3001/health`

---

## 4. Run the frontend locally

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173> in your browser.

---

## 5. Deploy the backend on Render

1. Push your code to a GitHub repository.
2. Go to <https://render.com> and create a **New Web Service**.
3. Connect your GitHub repository.
4. Configure the service:
   - **Root directory**: `backend`
   - **Build command**: `npm install`
   - **Start command**: `npm start`
   - **Environment**: Node
5. Add environment variables in the Render dashboard (same as your `.env` file):
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - `FRONTEND_URL` → your frontend URL
   - `BACKEND_URL`  → the Render service URL (visible after first deploy)
6. Click **Create Web Service**. Render will deploy automatically on every push to your main branch.

> **Note**: After deployment, update `BACKEND_URL` in Render env vars with the actual `https://xxxx.onrender.com` URL so magic links work correctly.

---

## 6. Set up Resend

1. Create a free account at <https://resend.com>.
2. Verify a sending domain (or use the Resend sandbox domain for testing):
   - Go to **Domains → Add Domain** and follow the DNS instructions.
   - For quick testing without a custom domain, Resend lets you send to your own email address from `onboarding@resend.dev`.
3. Go to **API Keys → Create API Key** — copy it as `RESEND_API_KEY`.
4. Set `RESEND_FROM_EMAIL` to a verified sender (e.g. `noreply@yourdomain.com`).

---

## Project structure

```
essai-web/
├── README.md
├── backend/
│   ├── .env.example          # Copy to .env and fill in
│   ├── package.json
│   ├── schema.sql            # Run this in Supabase SQL editor
│   ├── server.js             # Express app entry point
│   └── routes/
│       ├── auth.js           # POST /api/auth/request-login, GET /api/auth/verify, GET /api/auth/me
│       └── todos.js          # GET/POST /api/todos, DELETE /api/todos/:id
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.js
        ├── App.vue           # Root component, auth state, todo list
        ├── style.css         # Global dark-theme styles
        └── components/
            ├── AuthModal.vue     # Magic-link login form
            ├── AddTodoModal.vue  # Create todo (image, text, date, colour)
            ├── TodoList.vue      # Grid wrapper
            └── TodoItem.vue      # Single todo card with glow effect
```

---

## API reference

| Method | Path                        | Auth     | Description                        |
|--------|-----------------------------|----------|------------------------------------|
| POST   | /api/auth/request-login     | No       | Send magic-link email              |
| GET    | /api/auth/verify?token=xxx  | No       | Verify token → redirect with JWT   |
| GET    | /api/auth/me                | Bearer   | Return current user info           |
| GET    | /api/todos                  | No       | List all todos                     |
| POST   | /api/todos                  | Bearer   | Create todo                        |
| DELETE | /api/todos/:id              | Bearer   | Delete own todo                    |
| GET    | /health                     | No       | Health check                       |
