# Personal Blog Platform

A small blogging platform — **articles, users, comments and likes** — built with
plain HTML/CSS/JavaScript on the front end and **Node.js + Express + MySQL** on the
back end, following an MVC layout (`routes → controllers → models`).

Authentication is session-based (server-side session store, HttpOnly cookie) with
bcrypt-hashed passwords, role-based access control (`user` / `author` / `admin`) and
per-resource ownership checks.

---

## 1. Project structure

```
Blog-Website/
├── app.js                     # Express app: middleware, CORS, sessions, route mounting
├── config/
│   ├── dbConfig.js            # mysql2 connection pool (env-driven, TLS-aware)
│   └── sessionConfig.js       # express-session + MySQL session store
├── middleware/
│   ├── authMiddleware.js      # loadSessionUser, requireAuth, requireRole, ownership
│   ├── csrf.js                # synchroniser-token CSRF protection
│   ├── rateLimiters.js        # login / register / write rate limits
│   └── validate.js            # input validators & helpers
├── controllers/               # auth, article, comment, like, user
├── models/                    # SQL for users, articles, comments, likes
├── routes/                    # /api/auth, /api/articles, /api/users, /api/comments, /api/likes
├── public/                    # index.html, styles.css, app.js (front end)
├── scripts/
│   ├── setupDb.js             # create database + tables + seed users
│   ├── schema.sql             # idempotent schema (users/articles/comments/likes)
│   └── test-api.js            # automated API test suite
├── docs/tidb-migration.md     # step-by-step TiDB Cloud migration guide
├── .env.example               # template (no real secrets)
└── .gitignore                 # excludes .env, dumps, node_modules
```

---

## 2. Prerequisites

- **Node.js 18+** (the test suite uses the global `fetch` API).
- **MySQL 8** running locally, or a free **TiDB Cloud** cluster (MySQL-compatible).
- npm.

---

## 3. Local setup

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
#    (Windows PowerShell)
Copy-Item .env.example .env
#    (macOS / Linux)
cp .env.example .env
```

Now edit `.env` and fill in at minimum `DB_USER` / `DB_PASSWORD` for your local
MySQL, and generate a real `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Create the database, tables, indexes and seed users:

```bash
npm run db:setup
```

> `db:setup` is safe to run repeatedly — it uses `CREATE TABLE IF NOT EXISTS` and
> adds the `role` column to a pre-existing `users` table if it is missing.
> It seeds three accounts, all with the password **`Password123!`**:
> `alex@example.com` (admin), `sarah@example.com` (author), `sam@example.com` (author).

Start the server:

```bash
npm start        # production-style start
npm run dev      # auto-restart on file changes (node --watch)
```

Open <http://localhost:3000> — the front end is served from `public/` on the same
origin as the API.

---

## 4. Environment variables

All settings are read from the environment (see `.env.example`), with sensible
local defaults when unset.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` enables secure cookies, strict CORS and hidden 5xx messages |
| `PORT` | `3000` | HTTP port (most hosts set this automatically) |
| `SESSION_SECRET` | — | **Required in production.** Signs the session cookie (≥16 chars, 32+ recommended) |
| `SESSION_MAX_AGE_MS` | `86400000` | Session/cookie lifetime in milliseconds |
| `SESSION_COOKIE_NAME` | `sid` | Session cookie name |
| `COOKIE_SECURE` | auto | Force the `Secure` cookie flag on/off (auto = on when `NODE_ENV=production`) |
| `BCRYPT_ROUNDS` | `10` | bcrypt cost factor |
| `DEFAULT_REGISTRATION_ROLE` | `author` | Role given to new sign-ups (`user` \| `author` \| `admin`) |
| `ALLOWED_ORIGINS` | *(empty)* | Comma-separated CORS origins. Empty = same-origin only |
| `DB_HOST` / `DB_PORT` | `localhost` / `3306` | MySQL host & port (TiDB Cloud: `…tidbcloud.com` / `4000`) |
| `DB_USER` / `DB_PASSWORD` | `root` / *(empty)* | MySQL credentials (TiDB Cloud user ends in `.root`) |
| `DB_NAME` | `personal_blog` | Database name (TiDB Cloud default: `test`) |
| `DB_CONNECTION_LIMIT` | `10` | Pool size |
| `DB_SSL` | `false` | Enable TLS — **required** (`true`) for TiDB Cloud |
| `DB_SSL_REJECT_UNAUTHORIZED` | `true` | Verify the server certificate; keep `true` for TiDB |
| `DB_SSL_CA` | — | Optional PEM CA certificate |

Never commit the real `.env` — it is already listed in `.gitignore`.

---

## 5. Authentication & authorisation model

**Who you are comes from the session only.** The session stores just the user id;
`loadSessionUser` re-reads the user (including its role) from the database on every
request. As a result a client cannot set its own `user_id` or `role`, deleted users
lose access immediately, and role changes take effect on the next request.

| Role | Can do |
| --- | --- |
| `user` | Read, comment, like |
| `author` | Everything a `user` can, **plus** create articles and edit/delete **their own** articles |
| `admin` | Everything, **plus** manage users, change roles, edit/delete **any** article or comment |

Protected endpoints:

| Route | Protection |
| --- | --- |
| `POST/PUT/DELETE /api/articles*` | signed in with role `author` or `admin` **and** owner-or-admin |
| `POST/DELETE /api/comments*` | signed in; delete = comment author, article author or admin |
| `POST /api/likes/toggle` | signed in |
| `GET/POST /api/users` | admin only |
| `PATCH /api/users/:id/role` | admin only |
| `GET/PUT /api/users/:id` | self or admin |
| `DELETE /api/users/:id` | admin only |

Security measures in place:

- Passwords hashed with **bcrypt**; the hash is never returned to clients.
- Login responds identically for "unknown email" and "wrong password", and always
  runs a bcrypt comparison, so response time does not leak which emails exist.
- Sessions are **regenerated on login** (prevents session fixation) and the CSRF
  token is rotated at the same time.
- **CSRF**: unsafe methods (`POST/PUT/PATCH/DELETE`) require the token issued by
  `GET /api/auth/csrf` in the `X-CSRF-Token` header (compared in constant time).
- **Rate limiting**: login (10 failed attempts / 15 min), register (20 / hour),
  unsafe API writes (60 / min).
- Cookies are `HttpOnly` + `SameSite=Lax`, and `Secure` in production.
- All SQL uses parameterised queries (`mysql2` placeholders); inputs are validated.
- `app.set('trust proxy', 1)` so `req.ip` and secure cookies work behind a hosting
  provider's reverse proxy.

---

## 6. API reference

| Method | Path | Auth | Body / notes |
| --- | --- | --- | --- |
| `GET` | `/api/health` | — | health probe |
| `GET` | `/api/auth/csrf` | — | returns `{ csrfToken }` |
| `POST` | `/api/auth/register` | — | `{ username, email, password }` → 201 + signed in |
| `POST` | `/api/auth/login` | — | `{ email, password }` → 200 + signed in |
| `POST` | `/api/auth/logout` | yes | destroys the session |
| `GET` | `/api/auth/me` | yes | current user (401 when anonymous) |
| `GET` | `/api/articles` | — | `?tag=` and `?date=YYYY-MM-DD` filters |
| `GET` | `/api/articles/:id` | — | single article |
| `POST` | `/api/articles` | author/admin | `{ title, tags, content }` |
| `PUT` | `/api/articles/:id` | owner/admin | `{ title, tags, content }` |
| `DELETE` | `/api/articles/:id` | owner/admin | — |
| `GET` | `/api/comments/article/:articleId` | — | comments for an article |
| `POST` | `/api/comments` | yes | `{ article_id, content }` |
| `DELETE` | `/api/comments/:id` | author/article author/admin | — |
| `GET` | `/api/likes/article/:articleId` | — | like count / list |
| `POST` | `/api/likes/toggle` | yes | `{ article_id }` |
| `GET` | `/api/users` | admin | list users |
| `POST` | `/api/users` | admin | `{ username, email, password, role }` |
| `GET` | `/api/users/:id` | self/admin | — |
| `PUT` | `/api/users/:id` | self/admin | `{ username, email }` (role is ignored here) |
| `PATCH` | `/api/users/:id/role` | admin | `{ role }` |
| `DELETE` | `/api/users/:id` | admin | — |

### Example: full session + CSRF flow

Unsafe requests must carry the CSRF token, so fetch it first and keep the cookie
jar. The examples use `curl.exe` (real curl) so they behave the same in PowerShell.

```bash
# 1. Get a CSRF token (also sets the session cookie)
curl.exe -c cookies.txt http://localhost:3000/api/auth/csrf

# 2. Sign in, sending the token from step 1 in X-CSRF-Token
curl.exe -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -H "X-CSRF-Token: <csrfToken-from-step-1>" ^
  -d "{\"email\":\"alex@example.com\",\"password\":\"Password123!\"}"

# 3. Who am I?
curl.exe -b cookies.txt http://localhost:3000/api/auth/me

# 4. Create an article (use the rotated csrfToken returned by the login response)
curl.exe -b cookies.txt -X POST http://localhost:3000/api/articles ^
  -H "Content-Type: application/json" ^
  -H "X-CSRF-Token: <csrfToken-from-login>" ^
  -d "{\"title\":\"hello\",\"tags\":\"lifestyle\",\"content\":\"first post\"}"

# 5. Sign out
curl.exe -b cookies.txt -X POST http://localhost:3000/api/auth/logout ^
  -H "X-CSRF-Token: <csrfToken-from-login>"
```

> On macOS/Linux use line continuations with `\` instead of `^`, and ordinary
> `curl` instead of `curl.exe`.
> Each successful login/register returns a **rotated** `csrfToken` — always use the
> newest value.

---

## 7. Testing

```bash
# terminal 1 — start the server
npm start

# terminal 2 — run the API test suite
npm run test:api
```

The suite (`scripts/test-api.js`) starts from a clean state and verifies:

1. health check;
2. unauthenticated requests to protected routes return **401**;
3. unsafe requests without a CSRF token are rejected (**403**);
4. registration works, returns the default role, and never leaks the password;
   duplicate email → **409**;
5. the session persists across requests;
6. logout ends the session; login works, and a wrong password → **401**;
7. articles: a forged `user_id` in the body is ignored (content is attributed to
   the session user), and another user's edit/delete → **403**;
8. comments: author is taken from the session; the article author may delete a comment;
9. likes toggle on and off;
10. role checks: a non-admin gets **403** on `/api/users` and on role changes, and
    cannot escalate their own role via `PUT /api/users/:id`;
11. the owner can delete their own article (then it 404s).

Point it at another host with `TEST_BASE_URL`:

```bash
# PowerShell
$env:TEST_BASE_URL="https://myblog.example.com"; npm run test:api
```

The admin-only checks use the seeded `alex@example.com` account. If that account
does not exist (e.g. on a fresh database) those checks are reported as
**SKIP** rather than failing.

---

## 8. Deploying with TiDB Cloud (free database)

The database is hosted on **TiDB Cloud**, which is MySQL-compatible, has a free
tier and needs no credit card. The complete, manual step-by-step guide —
creating the cluster, `mysqldump` export/import, verification queries, TLS
requirements and promoting the first admin — is in
[**docs/tidb-migration.md**](docs/tidb-migration.md).

Short version:

1. Create a **TiDB Cloud Starter** cluster and copy the connection details from
   *Connect* (host, port `4000`, user `<username>.root`, password, database).
2. Export locally and import into TiDB (`mysqldump` → `mysql`, see the guide).
3. Set these variables wherever the app runs:
   ```
   DB_HOST=gateway01.<region>.prod.aws.tidbcloud.com
   DB_PORT=4000
   DB_USER=<username>.root
   DB_PASSWORD=<generated password>
   DB_NAME=test
   DB_SSL=true
   DB_SSL_REJECT_UNAUTHORIZED=true
   ```
   `DB_PORT` must be **4000** and `DB_SSL` must be **true** — TiDB Cloud rejects
   unencrypted connections. Its certificate is publicly trusted, so no CA file is
   needed.
4. Set `NODE_ENV=production` and a strong `SESSION_SECRET`.
5. Verify the row counts, then run `npm run test:api` against the deployed URL.

Only the `DB_*` variables change — no application code is touched, and `mysql2`
with the existing connection pool and MVC structure stays exactly as it is.

---

## 9. Manual actions required (not automatable)

- **Provide database credentials.** The project cannot guess your MySQL/TiDB user
  or password — set `DB_USER` / `DB_PASSWORD` in `.env` (local) or in your host's
  environment variables.
  Until then the server starts but logs
  `Database : CONNECTION FAILED ✗ (ER_ACCESS_DENIED_ERROR)`.
- **Create the TiDB Cloud cluster** and supply its host, port, user, password and
  database name.
- **Generate a production `SESSION_SECRET`** and set `NODE_ENV=production`.
- **Run the data migration** (`mysqldump` / `mysql`) — see
  [docs/tidb-migration.md](docs/tidb-migration.md). Migration is *not* performed
  automatically, and its success is verified by the row-count queries in that
  guide.
