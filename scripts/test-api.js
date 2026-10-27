// Automated API test suite — auth, roles, and content endpoints.

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Seeded admin credentials; admin checks are skipped if login fails.
const SEEDED_ADMIN = { email: 'alex@example.com', password: 'Password123!' };

let passed = 0;
let failed = 0;
let skipped = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`   PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`   FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function skip(label, reason) {
  skipped += 1;
  console.log(`   SKIP  ${label} — ${reason}`);
}

// Prints the pass / fail / skip totals.
function summarize() {
  console.log('\n─────────────────────────────────────────────');
  console.log(`  Passed: ${passed}   Failed: ${failed}   Skipped: ${skipped}`);
  console.log('─────────────────────────────────────────────\n');
}

// Minimal HTTP client with a cookie jar and CSRF token.
class Client {
  constructor(name) {
    this.name = name;
    this.cookies = new Map();
    this.csrfToken = null;
  }

  get cookieHeader() {
    if (this.cookies.size === 0) return undefined;
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  storeCookies(response) {
    const setCookies = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [];

    for (const cookie of setCookies) {
      const [pair] = cookie.split(';');
      const index = pair.indexOf('=');
      if (index === -1) continue;

      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      // An empty value means the server cleared the cookie
      if (value === '') {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }

  async request(method, path, body) {
    const headers = {};
    const cookie = this.cookieHeader;
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    // Unsafe methods must echo the CSRF token
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && this.csrfToken) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }

    const response = await fetch(new URL(path, BASE_URL), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual'
    });

    this.storeCookies(response);

    const text = await response.text();
    let parsed = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // keep the raw text (e.g. an HTML error page)
    }

    // Keep the rotated CSRF token returned by auth responses
    if (parsed && typeof parsed === 'object' && typeof parsed.csrfToken === 'string') {
      this.csrfToken = parsed.csrfToken;
    }

    return { status: response.status, body: parsed };
  }

  get(path) { return this.request('GET', path); }
  post(path, body) { return this.request('POST', path, body); }
  put(path, body) { return this.request('PUT', path, body); }
  patch(path, body) { return this.request('PATCH', path, body); }
  del(path) { return this.request('DELETE', path); }

  // Fetches a CSRF token for the current session.
  async primeCsrf() {
    const res = await this.get('/api/auth/csrf');
    if (res.body && typeof res.body.csrfToken === 'string') this.csrfToken = res.body.csrfToken;
    return res;
  }
}

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function main() {
  console.log(`\n=== Blog API test suite (${BASE_URL}) ===\n`);

  // ── 0. Health ─────────────────────────────────────────────
  console.log('0. Health check');
  const anon = new Client('anonymous');
  const health = await anon.get('/api/health');
  check('GET /api/health returns 200', health.status === 200, `got ${health.status}`);
  if (health.status !== 200) {
    console.log('\nServer is not reachable — start it with `npm start` and rerun.\n');
    process.exitCode = 1;
    return;
  }

  // ── 1. Unauthenticated access ─────────────────────────────
  console.log('\n1. Unauthenticated access is blocked');
  await anon.primeCsrf();

  const meAnon = await anon.get('/api/auth/me');
  check('GET /api/auth/me (anonymous) → 401', meAnon.status === 401, `got ${meAnon.status}`);

  const createAnon = await anon.post('/api/articles', { title: 'x', content: 'y' });
  check('POST /api/articles (anonymous) → 401', createAnon.status === 401, `got ${createAnon.status}`);

  const usersAnon = await anon.get('/api/users');
  check('GET /api/users (anonymous) → 401', usersAnon.status === 401, `got ${usersAnon.status}`);

  const commentAnon = await anon.post('/api/comments', { article_id: 1, content: 'hi' });
  check('POST /api/comments (anonymous) → 401', commentAnon.status === 401, `got ${commentAnon.status}`);

  // ── 2. CSRF protection ────────────────────────────────────
  console.log('\n2. CSRF protection');
  const noCsrf = new Client('no-csrf');
  const csrfMissing = await noCsrf.post('/api/auth/register', {
    username: `nocsrf_${uniqueSuffix()}`,
    email: `nocsrf_${uniqueSuffix()}@test.com`,
    password: 'Password123!'
  });
  check('POST without X-CSRF-Token → 403', csrfMissing.status === 403, `got ${csrfMissing.status}`);

  // ── 3. Registration ───────────────────────────────────────
  console.log('\n3. Registration');
  const author = new Client('author');
  await author.primeCsrf();

  const suffix = uniqueSuffix();
  const authorEmail = `author_${suffix}@test.com`;
  const authorPassword = 'Password123!';

  const register = await author.post('/api/auth/register', {
    username: `author_${suffix}`,
    email: authorEmail,
    password: authorPassword
  });
  check('POST /api/auth/register → 201', register.status === 201, `got ${register.status}`);
  check(
    'registration assigns the default "author" role',
    register.body && register.body.data && register.body.data.role === 'author',
    `role = ${register.body && register.body.data && register.body.data.role}`
  );
  check(
    'registration response never includes a password',
    register.body && register.body.data && !('password' in register.body.data)
  );
  const authorId = register.body && register.body.data ? register.body.data.id : null;

  // Abort early if registration failed — the rest needs a working API.
  if (register.status !== 201) {
    console.log('\nAborting: a user could not be registered, so the API is not functional.');
    console.log('Most likely cause: the database is unreachable.');
    console.log('  • set DB_USER / DB_PASSWORD in .env (see README section 3)');
    console.log('  • run `npm run db:setup` to create the schema and seed users');
    console.log(`Registration response: ${register.status} ${JSON.stringify(register.body)}\n`);
    summarize();
    process.exitCode = 1;
    return;
  }

  // Prime CSRF first to test validation (400), not the CSRF guard.
  const emptyBody = new Client('empty-body');
  await emptyBody.primeCsrf();
  const emptyBodyRes = await emptyBody.post('/api/auth/register', {});
  check('register with an empty body → 400', emptyBodyRes.status === 400, `got ${emptyBodyRes.status}`);

  const dupe = new Client('dupe');
  await dupe.primeCsrf();
  const dupeRes = await dupe.post('/api/auth/register', {
    username: `other_${uniqueSuffix()}`,
    email: authorEmail,
    password: authorPassword
  });
  check('duplicate email → 409', dupeRes.status === 409, `got ${dupeRes.status}`);

  // ── 4. Session persistence & current user ─────────────────
  console.log('\n4. Session persistence');
  const me1 = await author.get('/api/auth/me');
  check('GET /api/auth/me after register → 200', me1.status === 200, `got ${me1.status}`);
  check('current user id matches the registered id', me1.body && me1.body.data && me1.body.data.id === authorId);

  const me2 = await author.get('/api/auth/me');
  check('session survives a second request', me2.status === 200 && me2.body.data.id === authorId);

  // ── 5. Logout then log back in ────────────────────────────
  console.log('\n5. Logout and login');
  const logout = await author.post('/api/auth/logout', {});
  check('POST /api/auth/logout → 200', logout.status === 200, `got ${logout.status}`);

  // Logout destroys the session, so fetch a new CSRF token next.
  await author.primeCsrf();

  const meAfterLogout = await author.get('/api/auth/me');
  check('session is destroyed after logout → 401', meAfterLogout.status === 401, `got ${meAfterLogout.status}`);

  const wrongPassword = await author.post('/api/auth/login', {
    email: authorEmail,
    password: 'definitely-wrong'
  });
  check('login with wrong password → 401', wrongPassword.status === 401, `got ${wrongPassword.status}`);

  const login = await author.post('/api/auth/login', { email: authorEmail, password: authorPassword });
  check('POST /api/auth/login → 200', login.status === 200, `got ${login.status}`);
  check('login returns the user and a fresh CSRF token', Boolean(login.body.csrfToken) && !!login.body.data);

  // ── 6. Articles: create, read, ownership ──────────────────
  console.log('\n6. Articles and ownership');
  const create = await author.post('/api/articles', {
    // Hostile client sets someone else's id — must be ignored
    user_id: 999999,
    title: 'Ownership test article',
    content: 'Content created by the automated test suite.',
    tags: 'testing,api'
  });
  check('POST /api/articles (author) → 201', create.status === 201, `got ${create.status}`);
  const articleId = create.body.id;

  const fetched = await author.get(`/api/articles/${articleId}`);
  check('GET /api/articles/:id → 200', fetched.status === 200, `got ${fetched.status}`);
  const fetchedOwnerId = fetched.body && fetched.body.data ? fetched.body.data.user_id : undefined;
  check(
    'article author is the signed-in user (client-supplied user_id ignored)',
    fetchedOwnerId === authorId,
    `user_id = ${fetchedOwnerId}, expected ${authorId}`
  );

  const update = await author.put(`/api/articles/${articleId}`, {
    title: 'Ownership test article (updated)',
    content: 'Updated content.',
    tags: 'testing'
  });
  check('PUT /api/articles/:id by owner → 200', update.status === 200, `got ${update.status}`);

  // Another user with the same role must not touch this article
  const intruder = new Client('intruder');
  await intruder.primeCsrf();
  const intruderSuffix = uniqueSuffix();
  const intruderRegister = await intruder.post('/api/auth/register', {
    username: `intruder_${intruderSuffix}`,
    email: `intruder_${intruderSuffix}@test.com`,
    password: 'Password123!'
  });
  check('second account registered → 201', intruderRegister.status === 201, `got ${intruderRegister.status}`);

  const foreignUpdate = await intruder.put(`/api/articles/${articleId}`, {
    title: 'hijacked',
    content: 'hijacked'
  });
  check('PUT another user\'s article → 403', foreignUpdate.status === 403, `got ${foreignUpdate.status}`);

  const foreignDelete = await intruder.del(`/api/articles/${articleId}`);
  check('DELETE another user\'s article → 403', foreignDelete.status === 403, `got ${foreignDelete.status}`);

  const notFound = await author.get('/api/articles/99999999');
  check('GET missing article → 404', notFound.status === 404, `got ${notFound.status}`);

  // ── 7. Comments ───────────────────────────────────────────
  console.log('\n7. Comments');
  const comment = await intruder.post('/api/comments', {
    article_id: articleId,
    // hostile client tries to comment as the article's author
    user_id: authorId,
    content: 'A comment from the intruder client.'
  });
  check('POST /api/comments → 201', comment.status === 201, `got ${comment.status}`);
  const commentId = comment.body.id;

  const commentList = await author.get(`/api/comments/article/${articleId}`);
  check('GET /api/comments/article/:id → 200', commentList.status === 200, `got ${commentList.status}`);
  const commentRows = (commentList.body && commentList.body.data) || [];
  const posted = commentRows.find((c) => c.id === commentId);
  check(
    'comment author comes from the session, not the request body',
    posted && posted.user_id !== authorId,
    `user_id = ${posted && posted.user_id}`
  );

  const foreignCommentDelete = await new Client('third').request('DELETE', `/api/comments/${commentId}`);
  check('DELETE comment (another anonymous client) → 401/403', [401, 403].includes(foreignCommentDelete.status), `got ${foreignCommentDelete.status}`);

  const authorDeletesComment = await author.del(`/api/comments/${commentId}`);
  check(
    'article author may delete a comment on their article → 200',
    authorDeletesComment.status === 200,
    `got ${authorDeletesComment.status}`
  );

  // ── 8. Likes ──────────────────────────────────────────────
  console.log('\n8. Likes');
  const like1 = await intruder.post('/api/likes/toggle', { article_id: articleId, user_id: authorId });
  check('POST /api/likes/toggle → 200 and liked', like1.status === 200 && like1.body.liked === true, `got ${like1.status}`);

  const like2 = await intruder.post('/api/likes/toggle', { article_id: articleId });
  check('toggling again removes the like', like2.status === 200 && like2.body.liked === false, `got ${like2.status}`);

  const likeList = await author.get(`/api/likes/article/${articleId}`);
  check('GET /api/likes/article/:id → 200', likeList.status === 200 && likeList.body.data && typeof likeList.body.data.count === 'number');

  // ── 9. Role-based access control ──────────────────────────
  console.log('\n9. Role-based access control');
  const authorOnUsers = await author.get('/api/users');
  check('GET /api/users as author → 403', authorOnUsers.status === 403, `got ${authorOnUsers.status}`);

  const authorCreatesUser = await author.post('/api/users', {
    username: `sneaky_${uniqueSuffix()}`,
    email: `sneaky_${uniqueSuffix()}@test.com`,
    password: 'Password123!',
    role: 'admin'
  });
  check('POST /api/users as author → 403 (no privilege escalation)', authorCreatesUser.status === 403, `got ${authorCreatesUser.status}`);

  const authorPromotesSelf = await author.patch(`/api/users/${authorId}/role`, { role: 'admin' });
  check('PATCH /api/users/:id/role as author → 403', authorPromotesSelf.status === 403, `got ${authorPromotesSelf.status}`);

  const authorElevationViaUpdate = await author.put(`/api/users/${authorId}`, {
    username: `author_${suffix}`,
    email: authorEmail,
    role: 'admin' // must be ignored
  });
  const meAfterElevation = await author.get('/api/auth/me');
  const roleAfterElevation = meAfterElevation.body && meAfterElevation.body.data
    ? meAfterElevation.body.data.role
    : undefined;
  check(
    'PUT /api/users/:id cannot change a role',
    authorElevationViaUpdate.status === 200 && roleAfterElevation === 'author',
    `status ${authorElevationViaUpdate.status}, role ${roleAfterElevation}`
  );

  // Optional admin flow using the seeded account
  const admin = new Client('admin');
  await admin.primeCsrf();
  const adminLogin = await admin.post('/api/auth/login', SEEDED_ADMIN);

  if (adminLogin.status === 200) {
    const allUsers = await admin.get('/api/users');
    check('GET /api/users as admin → 200', allUsers.status === 200, `got ${allUsers.status}`);

    const promote = await admin.patch(`/api/users/${authorId}/role`, { role: 'admin' });
    check('PATCH /api/users/:id/role as admin → 200', promote.status === 200, `got ${promote.status}`);

    const demote = await admin.patch(`/api/users/${authorId}/role`, { role: 'author' });
    check('admin can demote back to author → 200', demote.status === 200, `got ${demote.status}`);
  } else {
    skip(
      'admin-only checks',
      'seeded admin could not sign in — run `npm run db:setup` on a fresh database (seed password: Password123!)'
    );
  }

  // ── 10. Owner cleanup ─────────────────────────────────────
  console.log('\n10. Article deletion by owner');
  const ownerDelete = await author.del(`/api/articles/${articleId}`);
  check('DELETE own article → 200', ownerDelete.status === 200, `got ${ownerDelete.status}`);

  const afterDelete = await author.get(`/api/articles/${articleId}`);
  check('deleted article is gone → 404', afterDelete.status === 404, `got ${afterDelete.status}`);

  // ── Summary ───────────────────────────────────────────────
  summarize();

  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('\nTest suite crashed:', error);
  process.exitCode = 1;
});
