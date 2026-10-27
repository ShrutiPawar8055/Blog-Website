/* ═══════════════════════════════════════════════════════
   shruti. — Personal Blog Frontend
   Connects to Express/MySQL backend at /api/*
═══════════════════════════════════════════════════════ */

// ─── STATE ──────────────────────────────────────────────
// The signed-in user comes from the server session (/api/auth/me).
let currentUser     = null;
let csrfToken       = null;     // echoed back on every write request
let authMode        = 'login';  // 'login' | 'register'
let articlesData    = [];
let activeCategory  = 'all';
let searchQuery     = '';
let currentArticleId = null;
let searchDebounce  = null;

// Slideshow state
let currentSlideIndex = 0;
let slideInterval     = null;

// ─── INIT ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupNavScroll();
  setupEventListeners();
  await initAuth();
  await loadArticles();
  handleHashNavigation();
  initSlideshow();
});

// ─── API HELPER ─────────────────────────────────────────
// fetch wrapper: sends cookies and CSRF token, refreshes state on 401.
async function apiFetch(method, path, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const res = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  let result = null;
  try { result = await res.json(); } catch { result = null; }

  if (result && typeof result.csrfToken === 'string') csrfToken = result.csrfToken;

  if (res.status === 401 && currentUser) {
    // Session gone: refresh the CSRF token for the new session.
    await initAuth();
  }

  return { ok: res.ok, status: res.status, result };
}

// ─── AUTH ───────────────────────────────────────────────
// Loads the CSRF token and the current session.
async function initAuth() {
  try {
    const res  = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
    const data = await res.json();
    if (data && typeof data.csrfToken === 'string') csrfToken = data.csrfToken;
  } catch (err) {
    console.warn('Could not obtain a CSRF token:', err);
  }

  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    currentUser = res.ok ? (await res.json()).data : null;
  } catch (err) {
    console.warn('Could not load the session:', err);
    currentUser = null;
  }

  renderAuthUI();
}

// Reflects the current session in the nav and auth modal.
function renderAuthUI() {
  const signedIn = Boolean(currentUser);
  const canWrite = signedIn && ['author', 'admin'].includes(currentUser.role);

  const writeBtn = document.getElementById('btn-open-create-modal');
  if (writeBtn) writeBtn.classList.toggle('hidden', !canWrite);

  const accountBtn = document.getElementById('btn-open-user-modal');
  if (accountBtn) {
    accountBtn.textContent = signedIn ? currentUser.username : 'sign in';
    accountBtn.setAttribute('aria-label', signedIn ? 'Account' : 'Sign in or create an account');
  }

  const accountView = document.getElementById('auth-account-view');
  const form        = document.getElementById('user-form');
  if (accountView) accountView.classList.toggle('hidden', !signedIn);
  if (form)        form.classList.toggle('hidden', signedIn);

  if (signedIn) {
    setTextContent('auth-username', currentUser.username);
    setTextContent('auth-role-hint', `role: ${currentUser.role}`);
  }
}

function openAuthModal() {
  authMode = 'login';
  setAuthError('');
  updateAuthModal();
  document.getElementById('user-modal').classList.add('active');
}

// Switches the modal between sign-in and register.
function updateAuthModal() {
  const isRegister = authMode === 'register';

  document.getElementById('auth-username-group').classList.toggle('hidden', !isRegister);
  document.getElementById('user-username').required = isRegister;

  setTextContent('user-modal-title', isRegister ? 'join the space ♡' : 'welcome back ♡');
  setTextContent('create-user-btn',  isRegister ? 'create account' : 'sign in');
  setTextContent('auth-switch-text', isRegister ? 'already have an account?' : 'new here?');
  setTextContent('auth-switch-btn',  isRegister ? 'sign in' : 'create an account');

  document.getElementById('user-password').setAttribute(
    'autocomplete',
    isRegister ? 'new-password' : 'current-password'
  );
}

function setAuthError(message) {
  const el = document.getElementById('auth-error');
  if (el) el.textContent = message || '';
}

// Handles sign-in or registration based on authMode.
async function handleAuthSubmit(e) {
  e.preventDefault();
  if (currentUser) return;

  const isRegister = authMode === 'register';
  const username   = document.getElementById('user-username').value.trim();
  const email      = document.getElementById('user-email').value.trim();
  const password   = document.getElementById('user-password').value;

  const btn = document.getElementById('create-user-btn');
  btn.disabled = true;
  setAuthError('');

  try {
    const path    = isRegister ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegister ? { username, email, password } : { email, password };

    const { ok, result } = await apiFetch('POST', path, payload);

    if (!ok) {
      setAuthError((result && result.error) || 'Something went wrong. Please try again.');
      return;
    }

    currentUser = result.data;
    document.getElementById('user-form').reset();
    document.getElementById('user-modal').classList.remove('active');
    renderAuthUI();
    await loadArticles(); // permissions changed, and a fresh database may be seeded
  } catch (err) {
    console.error('Authentication failed:', err);
    setAuthError('Could not reach the server. Please try again.');
  } finally {
    btn.disabled = false;
    updateAuthModal();
  }
}

async function signOut() {
  try {
    await apiFetch('POST', '/api/auth/logout', {});
  } catch (err) {
    console.warn('Sign out request failed:', err);
  }

  currentUser = null;
  document.getElementById('user-modal').classList.remove('active');
  await initAuth();       // the ended session needs a fresh CSRF token
  await loadArticles();
}


// ─── THEME ──────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('blog-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('blog-theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ─── NAV SCROLL SHADOW ─────────────────────────────────
function setupNavScroll() {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.style.boxShadow = window.scrollY > 36
      ? '0 2px 24px rgba(0,0,0,0.09)'
      : 'none';
  }, { passive: true });
}

// ─── MOBILE NAV ────────────────────────────────────────
function toggleMobileNav() {
  const links = document.getElementById('nav-links');
  const icon  = document.getElementById('hamburger-icon');
  const btn   = document.getElementById('mobile-menu-btn');
  const open  = links.classList.toggle('open');
  if (icon) icon.textContent = open ? '✕' : '☰';
  if (btn)  btn.setAttribute('aria-expanded', String(open));
}

function closeMobileNav() {
  const links = document.getElementById('nav-links');
  const icon  = document.getElementById('hamburger-icon');
  const btn   = document.getElementById('mobile-menu-btn');
  links.classList.remove('open');
  if (icon) icon.textContent = '☰';
  if (btn)  btn.setAttribute('aria-expanded', 'false');
}

// ─── SEARCH ─────────────────────────────────────────────
function setupSearchOverlay() {
  const toggle  = document.getElementById('search-toggle');
  const overlay = document.getElementById('search-overlay');
  const closeBtn = document.getElementById('search-close');
  const input   = document.getElementById('search-input');
  if (!toggle || !overlay || !closeBtn || !input) return;

  toggle.addEventListener('click', () => {
    overlay.classList.add('open');
    setTimeout(() => input.focus(), 80);
  });

  const closeSearch = () => {
    overlay.classList.remove('open');
    input.value = '';
    searchQuery  = '';
    renderFilteredArticles();
  };

  closeBtn.addEventListener('click', closeSearch);

  input.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderFilteredArticles();
    }, 280);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeSearch();
  });
}

// ─── EVENT LISTENERS ─────────────────────────────────────
function setupEventListeners() {
  setupSearchOverlay();

  // Article modal
  document.getElementById('btn-open-create-modal')
    .addEventListener('click', () => openArticleModal());
  document.getElementById('close-article-modal')
    .addEventListener('click', closeArticleModal);
  document.getElementById('cancel-article-modal')
    .addEventListener('click', closeArticleModal);
  document.getElementById('article-form')
    .addEventListener('submit', handleSaveArticle);
  // Preview the chosen file (it takes priority over the URL field)
  document.getElementById('article-image-file')
    .addEventListener('change', handleImageFileChange);

  // Contact form
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', handleContactSubmit);
  }

  // Auth modal (sign in / create account / sign out)
  const userModal = document.getElementById('user-modal');
  document.getElementById('btn-open-user-modal')
    .addEventListener('click', openAuthModal);
  document.getElementById('close-user-modal')
    .addEventListener('click', () => userModal.classList.remove('active'));
  document.getElementById('cancel-user-modal')
    .addEventListener('click', () => userModal.classList.remove('active'));
  document.getElementById('user-form')
    .addEventListener('submit', handleAuthSubmit);
  document.getElementById('auth-switch-btn')
    .addEventListener('click', () => {
      authMode = authMode === 'register' ? 'login' : 'register';
      setAuthError('');
      updateAuthModal();
    });
  document.getElementById('auth-signout-btn')
    .addEventListener('click', signOut);

  // Close modals on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', (e) => {
      if (e.target === bd) bd.classList.remove('active');
    });
  });
}

// ─── LOAD ARTICLES ──────────────────────────────────────
async function loadArticles() {
  const grid = document.getElementById('articles-grid');
  grid.innerHTML = `<div class="loading-state"><span class="loading-text-cursive cursive">loading stories...</span></div>`;

  try {
    const { result } = await apiFetch('GET', '/api/articles');

    if (!result || !result.success) throw new Error((result && result.error) || 'API error');

    articlesData = result.data;

    // Seed default content only when empty and signed in.
    if (articlesData.length === 0 && currentUser) {
      await seedDefaultContent();
      const { result: reloaded } = await apiFetch('GET', '/api/articles');
      if (reloaded && reloaded.success) articlesData = reloaded.data;
    }

    renderFilteredArticles();
  } catch (err) {
    console.error('Failed to load articles:', err);
    grid.innerHTML = `
      <div class="empty-state">
        <span class="cursive-large">server's quiet right now ♡</span>
        <p style="color:var(--text-muted);font-size:.9rem;">Make sure MySQL &amp; Node.js are running, then refresh.</p>
      </div>`;
  }
}

// ─── SEED CONTENT ───────────────────────────────────────
async function seedDefaultContent() {
  const articles = [
    {
      title: 'how i (try to) manage time between college and work hours',
      tags:  'coverimg:1484480974693-6ca0a78fb36b,productivity',
      content:
`Let me be real with you — I don't have a perfect system. Nobody does, especially when you're juggling a full college schedule, a part-time job or internship, assignments piling up, and still trying to maintain some semblance of a human life.

But I've tried enough things to know what actually works (for me, at least), and what's just productivity theater.

**The Sunday Reset**

Every Sunday evening, I open my notebook and brain-dump everything I need to do that week. Not sorted, not prioritized — just everything. Assignments with deadlines, work deliverables, errands, phone calls I've been avoiding, emails sitting in my draft folder since Tuesday. Getting it all out of my head and onto paper is genuinely the most calming part of my week.

Once everything's on the page, I sort it by day and estimate how long each task will take. This one step saves me from the Sunday-night spiral of "I have so much to do and I don't even know where to start."

**Time Blocking Over To-Do Lists**

I used to be a to-do list person. Long, ambitious lists that felt satisfying to write and crushing to look at by 11 AM. The problem with to-do lists is they exist outside of time — they have no sense of how long things actually take.

Time blocking changed everything. I use Google Calendar and block actual chunks of time for tasks. College lectures are fixed blocks. Deep work sessions for assignments get 90-minute blocks in the morning. Work tasks get slotted in the afternoon. Even "reply to emails" gets its own 20-minute block, because otherwise I spend all day switching context.

If it doesn't have a time slot, it doesn't happen. That's the rule.

**My Modified Pomodoro**

Classic Pomodoro is 25 minutes on, 5 minutes off. I tried it — by the time I was actually in the zone, the timer would go off and ruin everything.

My version: 45 minutes of focused work, 15 minutes of actual rest. During those 15 minutes, I step away from the screen. Get water, look out the window, stretch. Not "break while scrolling Instagram" — that's not a break, that's just different stimulation.

The 45-minute chunks are long enough to make real progress and short enough that I'm not completely fried by the end.

**Protecting My Mornings**

On days without an 8 AM lecture (which feels like a gift every single time), I protect the first 90 minutes of my morning hard. No phone, no social media, no news. I eat breakfast, look at my calendar, and start on the hardest task of the day.

This is the "eat the frog" principle — do the most dreaded thing first, and everything else feels easier by comparison. It's irritatingly effective.

**The Honest Truth**

There are weeks where all of this falls apart. Where I'm submitting assignments at midnight and stress-eating at 2 AM and my calendar looks like abstract art. And that's okay.

The point of having a system isn't to be perfect. It's to have something to return to when the chaos settles — a framework that takes the decision-making fatigue out of "what do I do next?"

Start with just one thing. Maybe the Sunday brain dump. Do it for two weeks before adding anything else. Consistency beats optimization every single time, and the best system is the one you'll actually use.`
    },

    {
      title: 'my daily routine — the honest, messy version',
      tags:  'coverimg:1499750310107-5fef28a66643,lifestyle',
      content:
`My daily routine is nowhere near as aesthetic as the ones on YouTube. There's no golden-hour journaling session, no 5 AM workout, no elaborate breakfast spread. But here's what it actually looks like — the honest version.

**Morning (when it goes well)**

I wake up somewhere between 7 and 7:30 AM. I try not to look at my phone for the first 10 minutes, mostly because the news cycle is aggressively depressing and I'd like to ease into consciousness before confronting it.

I drink a glass of water before anything else. This sounds simple but it genuinely helps — you've been fasting for 7-8 hours and your body is mildly dehydrated. Water before coffee, always.

Then I make chai (I'm Indian, it's non-negotiable), and I sit with it for a few minutes without doing anything. No screen, no input. Just morning and tea. This is probably the most productive thing I do all day, paradoxically.

**College Hours**

On weekdays, college takes up most of my morning and part of my afternoon. I try to sit in the front or middle of class — not because I'm that student, but because I genuinely retain more when I'm not in the back scrolling my phone.

Between lectures, I review what I just studied. Even 5 minutes of looking over notes while concepts are fresh beats an hour of re-learning later. I use Notion for notes, and I keep a rolling "to review" section that I work through during transit.

**Afternoon Deep Work**

After college, I eat lunch and then have about 2-3 hours that I try to protect for real work — assignments, side projects, coding practice. I let myself have a 20-minute nap if I need one. I've made peace with the fact that my productivity isn't linear, and fighting that is more exhausting than just accepting it.

The key is knowing the difference between "I need a genuine reset" and "I'm avoiding the hard thing." These feel different, but you have to be honest with yourself about which one is happening.

**Evening Wind-Down**

My phone goes on do-not-disturb at 9:30 PM. Not because I'm disciplined — because I learned the hard way that doom-scrolling until midnight is a direct path to feeling terrible the next day.

I read for 30 minutes before sleep. Anything — fiction, non-fiction, articles saved to my reading list. The point is to get off screens and let my brain shift gears.

I also do a quick brain dump at night — just a few lines in my notes app about what I got done, what's pending, and anything I don't want to forget. Takes 3 minutes and means I actually sleep instead of mentally rehearsing my to-do list at 2 AM.

**The Parts That Are Actually Hard**

Weekends are chaos. My routine collapses entirely and I spend Saturday feeling vaguely guilty about everything I'm not doing. Sunday is when I reset, which helps.

I'm also not great at exercise. I try to walk at least 20 minutes a day, usually in the evening. It's not much, but it's consistent, and that matters more to me than having an aspirational gym schedule I abandon after two weeks.

Routines are personal. What works for me might be completely wrong for you. The only principles I believe are universal: protect your mornings, protect your sleep, and give yourself actual breaks — not the phone-scrolling kind.

Everything else is just iteration.`
    },

    {
      title: 'eating for energy: nutrition and a balanced diet that actually works for me',
      tags:  'coverimg:1512621776951-a57141f2eefd,lifestyle,health',
      content:
`I spent most of my first year of college eating whatever was cheapest and most convenient — which meant a lot of instant noodles, white bread, and the occasional banana if I was feeling virtuous. By second year, I was constantly tired, my skin was breaking out, and my focus during lectures was genuinely terrible.

That's when I started paying attention to what I was eating. Not in a restrictive way — I'm not built for diets that forbid entire food groups. But in a "what is my body actually running on?" kind of way.

**The Basics I Keep Coming Back To**

Protein at every meal made the biggest single difference in how I felt. Protein keeps you full longer, stabilises blood sugar, and is essential for sustained focus and energy. For me, that means eggs at breakfast, dal or paneer at lunch, and some form of protein at dinner. When I skip it, I feel the 3 PM crash hard.

Iron is non-negotiable for me — I'm prone to anaemia. Spinach, lentils, dark chocolate (yes, this counts), and occasional red meat. I always pair iron-rich foods with Vitamin C — a squeeze of lemon on dal, tomatoes in spinach — because Vitamin C dramatically increases iron absorption. This combination is genuinely underrated.

Hydration. Most of the time when I feel foggy or unfocused, I'm just dehydrated. I keep a 1-litre bottle on my desk and try to finish it twice before 5 PM. Not exciting advice. Genuinely transformative.

Omega-3s — walnuts, flaxseeds, and fatty fish if you eat it. Critical for brain function, and I notice a difference when I'm not eating enough of them. I add a handful of walnuts to my breakfast most days.

**Meal Prepping on a College Budget**

Sunday is meal prep day. I cook a big batch of rice or roti, a dal or sabzi that keeps well, and hard-boil a few eggs. This means I always have something real to eat without making decisions when I'm already tired and hungry — which is exactly when the bad choices happen.

My staple meals:

- Breakfast: eggs (scrambled or boiled) + toast + banana + chai
- Lunch: rice + dal + a vegetable
- Dinner: lighter — roti, sabzi, sometimes just a bowl of curd rice
- Snacks: peanut butter on toast, roasted chana, fruit, dark chocolate

This isn't fancy. It's also not Instagram-worthy. But it's consistent, affordable, and it works.

**What I've Stopped Feeling Guilty About**

Eating dessert. Having processed food sometimes. Going to McDonald's occasionally. Drinking chai three times a day.

Nutrition is a long game. The 80/20 principle applies — if 80% of what I eat is reasonably nourishing, the other 20% doesn't matter much. Obsessing over every bite is its own kind of unhealthy.

**Supplements I Actually Take**

After getting bloodwork done, I found I was deficient in Vitamin D — extremely common in India if you spend most of the day indoors. I take Vitamin D3 + K2 daily. I also take Vitamin B12 because I'm mostly vegetarian, and B12 deficiency sneaks up on you very slowly in ways that are easy to dismiss as "just tiredness" until they're not.

Everything else I try to get from food first. Supplements fill gaps — they don't replace a bad diet.

**The Simple Version**

Eat more protein. Drink more water. Sleep enough. These three things, done consistently, will do more for your energy and focus than any supplement stack or elaborate protocol. The rest is just details.`
    },

    {
      title: 'my skincare routine (salicylic acid, vitamin c, and everything in between)',
      tags:  'coverimg:1556228578-8c89e6adf883,skincare,personal',
      content:
`I've been on a skincare journey for about two years now — which is a very fancy way of saying I've spent a lot of money on products that didn't work and learned things the hard way so you don't have to.

Here's my current routine: what I use, why I use it, and what actually made a difference.

**The Context**

My skin is combination-oily and acne-prone, and it tends toward hyperpigmentation — dark spots that linger after breakouts, sometimes for months. I live in a humid climate, so anything too heavy tends to clog my pores. Knowing this about my skin before building a routine was the most important step. Understand your skin type first, before throwing products at it.

**Morning Routine**

*Salicylic Acid Cleanser.* I use a 1–2% salicylic acid face wash in the morning. Salicylic acid is a BHA (beta-hydroxy acid) that gets into pores and dissolves the sebum and dead skin cells that cause congestion and breakouts. If you have oily or acne-prone skin and aren't using salicylic acid, it's probably the most impactful thing you can add. I use the CeraVe Salicylic Acid Cleanser. The COSRX Low pH Good Morning Gel Cleanser is excellent and more affordable.

*Vitamin C Serum.* After cleansing, I apply a Vitamin C serum. Vitamin C is an antioxidant that fades hyperpigmentation, brightens skin tone, and protects against environmental damage. It works best in the morning when you're about to face UV exposure. I use Paula's Choice C15 Super Booster — pricey but stable and effective. Budget pick: Minimalist 10% Vitamin C serum works well and is genuinely affordable.

*Moisturiser + Sunscreen.* Always, always sunscreen. Sun damage is the number one cause of premature ageing and makes hyperpigmentation dramatically worse. I use a lightweight SPF 50 PA+++ sunscreen as the last morning step — currently the Anua Birch Juice Moisturising Sunscreen. Hydrating, not greasy, no white cast.

**Evening Routine**

*Double Cleanse.* I start with an oil cleanser to break down sunscreen and the day's pollution, followed by a gentle water-based cleanser. Double cleansing sounds excessive but it makes a real difference — single cleansing often doesn't remove sunscreen fully, and wearing sunscreen residue overnight is counterproductive.

*Niacinamide Serum.* Niacinamide (Vitamin B3) does a remarkable number of things: reduces pore appearance, balances oil production, fades dark spots, and strengthens the skin barrier. It's also one of the most well-tolerated actives — almost no one reacts badly to it. I use the Minimalist 10% Niacinamide serum. I've been through six bottles.

*Retinol (2–3 nights a week).* Retinol is the gold standard for skin turnover — speeds up cell renewal, fades hyperpigmentation, helps with acne. I started with 0.1% and worked up slowly over months. Currently using 0.3%. Key rules: only at night, always follow with moisturiser, always wear SPF the next morning because retinol increases photosensitivity.

*Moisturiser.* I use a heavier moisturiser at night. Currently the Vanicream Moisturising Cream — fragrance-free, simple ingredients, genuinely nourishing.

**Products Worth It**

- CeraVe Salicylic Acid Cleanser
- COSRX Low pH Good Morning Gel Cleanser
- Minimalist 10% Niacinamide Serum
- Minimalist 10% Vitamin C Serum (budget)
- Paula's Choice C15 Super Booster (splurge)
- Anua Birch Juice Moisturising Sunscreen
- Retinol — start with 0.1%, go slow
- Vanicream Moisturising Cream

**What Took Longest to Learn**

Skincare takes time. Minimum three months to see real results from a new product. The impulse to try something new every two weeks is strong, but changing too many things at once means you never know what's actually working.

Also: sleep, water, and stress management do more for your skin than any product. The clearest skin I've ever had correlated directly with low-stress periods. No serum compensates for a week of bad sleep and exam anxiety.

Start simple. Cleanser, moisturiser, SPF. Master those before adding actives. Basics done consistently beat the fanciest routine done haphazardly.`
    },

    {
      title: 'my go-to resources for competitive programming (striver, tle, cses, acodedaily…)',
      tags:  'coverimg:1555066931-4365d14bab8c,productivity,coding',
      content:
`When I started competitive programming, I spent more time looking for the "right" resources than actually coding. The internet has no shortage of recommendations, and most of them contradict each other, which is very helpful.

So here's what I actually use — the resources I come back to consistently, the ones that moved me forward, and how I structure my practice around them.

**Striver's A2Z DSA Course**

If you've spent any time in the Indian coding community, you've heard of Striver (Raj Vikramaditya). His A2Z DSA Course on TakeUForward is probably the most comprehensive free resource for learning data structures and algorithms from scratch, in order.

What I like most: it's structured. There's a clear progression from arrays to trees to dynamic programming, and each concept builds on the last. The explanations are genuinely good — Striver has a way of making even complex problems feel approachable without dumbing them down.

The SDE Sheet is great specifically for interview prep — 180 carefully curated problems that cover everything you need for product company interviews. I work through a few problems from it each week during semester.

**TLE Eliminators**

TLE Eliminators is a community-driven competitive programming resource with excellent concept-wise practice sheets and video explanations, particularly for the topics that Codeforces problems love to punish you with — graphs, segment trees, DP optimisations, and number theory.

Their Discord community is also genuinely useful. Real people discussing problems, not just link-dumping. If you're stuck on a Codeforces problem at 11 PM, someone in TLE's server has probably solved it and is willing to explain their approach. The community vibe is supportive without being patronising.

**CSES Problem Set**

The CSES Problem Set (cses.fi) is a Finnish online judge with around 300 carefully selected problems, organised cleanly by topic. It's one of the best curated problem sets I've found — problems are clean, well-categorised, and range from introductory to genuinely hard without unnecessary fluff.

I use CSES as my primary topic-wise practice resource. Learning segment trees? CSES's range queries section. Graph algorithms? Their graph section is excellent. The problems are well-chosen and representative of what actually shows up in contests.

One note: CSES doesn't have built-in editorials, so you'll need external resources when stuck. This is fine — struggling with a problem before reading an editorial is often more educational than getting a hint early. The friction is part of the process.

**acodedaily.com**

acodedaily is one of those resources I found late and immediately wished I'd discovered earlier. It has well-written articles and problem explanations, particularly for dynamic programming and graph problems. The explanations are detailed without being overwhelming, and they do a good job of building from first principles.

I use it supplementarily — when Striver's or CSES's explanations aren't clicking for me, I check acodedaily for a different perspective on the same concept. Sometimes you just need someone to explain the same thing three different ways before it finally lands. Having multiple sources for this is genuinely valuable.

**Codeforces**

For actual competitive programming practice, nothing replaces Codeforces. The volume of problems is enormous, difficulty ratings are well-calibrated, and editorial quality is generally high.

My approach: virtual contests for simulated practice (pick an old CF round, start it, try to solve as many problems as possible in the allotted time), then upsolve everything I couldn't solve. The upsolving is often the most valuable part — reading an editorial and implementing a solution to a problem you just couldn't crack cements the concept far better than reading about it in isolation.

**How I Structure My Practice**

During semester: 1-2 problems a day from CSES or a targeted CF problem. Nothing ambitious — consistency matters more than volume.

Weekends: a virtual contest if I have time, or focused topic practice if I'm shoring up a specific weakness.

Long breaks: intensive topic learning — pick one weak area, spend a week on it thoroughly, do 15-20 problems on that topic.

**One Thing I Wish Someone Had Told Me Earlier**

Speed doesn't matter early on. Understanding matters. I've seen people grind 1000+ problems without improving much because they were solving problems they already knew how to solve, just faster. Growth comes from problems 1-2 difficulty levels above where you're comfortable — the problems that take 2 hours and three wrong submissions before clicking.

Embrace those. They're the ones that actually make you better.

And compete. Even if you place badly. Consistent contest participation, done over months and years, compounds in ways that solo practice simply cannot replicate.`
    }
  ];

  // Post all seed articles in parallel.
  await Promise.all(
    articles.map(art =>
      apiFetch('POST', '/api/articles', {
        title:   art.title,
        tags:    art.tags,
        content: art.content
      }).catch(err => console.warn('Error seeding article:', err))
    )
  );
}

// ─── CATEGORY FILTER ──────────────────────────────────
function filterByCategory(cat) {
  activeCategory = cat;
  searchQuery    = '';

  // Close search
  const overlay = document.getElementById('search-overlay');
  const input   = document.getElementById('search-input');
  if (overlay) overlay.classList.remove('open');
  if (input)   input.value = '';

  // Update explore pills
  document.querySelectorAll('.explore-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.cat === cat);
  });

  // Return to main view if reading
  if (currentArticleId !== null) closeArticlePage(false);

  renderFilteredArticles();

  // Smooth scroll to blog section
  setTimeout(() => {
    const blog = document.getElementById('blog-section');
    if (blog) blog.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
  closeMobileNav();
}

function goHome() {
  if (currentArticleId !== null) closeArticlePage(false);
  activeCategory = 'all';
  searchQuery    = '';
  document.querySelectorAll('.explore-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.cat === 'all');
  });
  renderFilteredArticles();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── RENDER ─────────────────────────────────────────────
function renderFilteredArticles() {
  let filtered = [...articlesData];

  if (activeCategory !== 'all') {
    filtered = filtered.filter(a => {
      const tags = parseTags(a.tags);
      return tags.some(t => t.toLowerCase() === activeCategory.toLowerCase());
    });
  }

  if (searchQuery) {
    filtered = filtered.filter(a =>
      a.title.toLowerCase().includes(searchQuery) ||
      (a.content && a.content.toLowerCase().includes(searchQuery))
    );
  }

  renderArticles(filtered);
}

function renderArticles(articles) {
  const grid    = document.getElementById('articles-grid');
  const countEl = document.getElementById('article-count');
  if (countEl) countEl.textContent = articles.length;

  if (articles.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <span class="cursive-large">nothing here yet ♡</span>
        <p style="color:var(--text-muted);font-size:.9rem;">
          No posts match — try a different category or search term.
        </p>
      </div>`;
    return;
  }

  grid.innerHTML = articles.map(art => {
    const tags     = parseTags(art.tags);
    // Image priority: image_url, uploaded image_data, legacy coverimg tag
    const coverImg = art.image_url || art.image_data || getCoverImage(art.tags);
    const category = tags[0] || 'personal';

    // Strip markdown markers for plain excerpt
    const rawExcerpt = (art.content || '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/\n/g, ' ')
      .slice(0, 158);
    const excerpt = rawExcerpt + (art.content?.length > 158 ? '…' : '');

    const date = art.published_at
      ? new Date(art.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'Recently';

    const imgStyle = coverImg
      ? `background-image:url('${coverImg}');background-size:cover;background-position:center;`
      : '';

    return `
      <article
        class="post-card"
        onclick="openArticlePage(${art.id})"
        tabindex="0"
        role="button"
        aria-label="Read article: ${escapeHtml(art.title)}"
      >
        <div class="post-card-image" style="${imgStyle}">
          <span class="post-category">${escapeHtml(category)}</span>
        </div>
        <div class="post-card-body">
          <h3 class="post-title">${escapeHtml(art.title)}</h3>
          <p class="post-excerpt">${escapeHtml(excerpt)}</p>
          <div class="post-meta">
            <span class="post-date">${date}</span>
            <span class="read-more">read more →</span>
          </div>
        </div>
      </article>`;
  }).join('');

  // Keyboard accessibility on cards
  document.querySelectorAll('.post-card').forEach(card => {
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
  });
}

// ─── TAG HELPERS ──────────────────────────────────────
function parseTags(tagsStr) {
  if (!tagsStr) return [];
  return tagsStr.split(',')
    .map(t => t.trim())
    .filter(t => t && !t.startsWith('coverimg:'));
}

function getCoverImage(tagsStr) {
  if (!tagsStr) return null;
  const coverTag = tagsStr.split(',').find(t => t.trim().startsWith('coverimg:'));
  if (!coverTag) return null;
  const photoId = coverTag.trim().replace('coverimg:', '');
  return `https://images.unsplash.com/photo-${photoId}?w=700&q=80&auto=format&fit=crop`;
}

// ─── ARTICLE READER ──────────────────────────────────
async function openArticlePage(id) {
  currentArticleId = id;

  document.getElementById('site-view').classList.add('hidden');
  const reader = document.getElementById('article-reader');
  reader.classList.remove('hidden');
  reader.scrollTop = 0;

  window.history.pushState({ articleId: id }, '', `#article-${id}`);

  reader.innerHTML = `<div class="reader-loading"><span class="cursive">loading your story...</span></div>`;

  try {
    const { result } = await apiFetch('GET', `/api/articles/${id}`);

    if (!result || !result.success) {
      reader.innerHTML = `
        <div class="reader-error">
          <p>Couldn't load this article.</p>
          <button class="back-btn" onclick="closeArticlePage()">← go back</button>
        </div>`;
      return;
    }

    const art      = result.data;
    const tags     = parseTags(art.tags);
    const coverImg = art.image_url || art.image_data || getCoverImage(art.tags);
    const category = tags[0] || 'personal';

    const date = art.published_at
      ? new Date(art.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'Recently';

    const wordCount = (art.content || '').split(/\s+/).filter(Boolean).length;
    const readTime  = `${Math.max(1, Math.ceil(wordCount / 200))} min read`;

    const bodyHtml  = renderMarkdown(art.content || '');
    const tagChips  = tags.map(t => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join('');

    const heroHtml  = coverImg
      ? `<div class="reader-hero-image" style="background-image:url('${coverImg.replace('w=700','w=1200')}')"></div>`
      : '';

    // Only the author or an admin may edit/delete (enforced by the API too)
    const canManage = currentUser &&
      (currentUser.role === 'admin' || currentUser.id === art.user_id);

    const manageHtml = canManage
      ? `<div class="reader-footer-actions">
          <button class="btn-ghost-sm" onclick="openEditFromReader(${art.id})" aria-label="Edit post">edit post</button>
          <button class="btn-ghost-sm danger" onclick="deleteArticleFromReader(${art.id})" aria-label="Delete post">delete</button>
        </div>`
      : '';

    reader.innerHTML = `
      <nav class="reader-nav">
        <button class="back-btn" onclick="closeArticlePage()" aria-label="Back to blog">
          ← back to blog
        </button>
        <div class="reader-actions">
          <button class="reader-like-btn" id="reader-like-btn" onclick="toggleReaderLike(${art.id})" aria-label="Like this post">
            ♡ <span id="reader-like-count">—</span>
          </button>
        </div>
      </nav>

      ${heroHtml}

      <div class="reader-content">
        <div class="reader-meta">
          <span class="reader-category">${escapeHtml(category)}</span>
          <span class="reader-date">${date} · ${readTime}</span>
        </div>

        <h1 class="reader-title">${escapeHtml(art.title)}</h1>

        <div class="reader-author">
          <div class="author-avatar-sm" aria-hidden="true">S</div>
          <span>shruti · personal blog</span>
        </div>

        <div class="reader-divider"></div>

        <div class="reader-body" id="reader-body">${bodyHtml}</div>

        <div class="reader-tags">${tagChips}</div>

        <div class="reader-divider"></div>

        <div class="reader-reactions">
          <button class="reaction-btn" id="reaction-btn" onclick="toggleReaderLike(${art.id})" aria-label="Like">
            <span class="reaction-icon" aria-hidden="true">♡</span>
            <span id="reaction-like-count">—</span> likes
          </button>
        </div>

        <div class="reader-comments">
          <h2 class="comments-heading">thoughts &amp; feelings</h2>
          <div id="reader-comments-list" class="reader-comments-list" role="list" aria-label="Comments">
            <div class="loading-text">loading comments...</div>
          </div>
          <div class="comment-form">
            <label for="reader-comment-input" class="sr-only">Write a comment</label>
            <input
              type="text"
              id="reader-comment-input"
              placeholder="leave a little note ♡"
              class="comment-input"
              autocomplete="off"
              aria-label="Write a comment"
            >
            <button class="btn-accent-filled" onclick="postReaderComment(${art.id})" id="post-comment-btn">post</button>
          </div>
        </div>

        ${manageHtml}
      </div>
    `;

    loadReaderLikes(art.id);
    loadReaderComments(art.id);

    // Enter to submit comment
    const commentInput = document.getElementById('reader-comment-input');
    if (commentInput) {
      commentInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') postReaderComment(art.id);
      });
    }

  } catch (err) {
    console.error('Error opening article:', err);
    reader.innerHTML = `
      <div class="reader-error">
        <p>Something went wrong loading this article.</p>
        <button class="back-btn" onclick="closeArticlePage()">← go back</button>
      </div>`;
  }
}

function closeArticlePage(doRender = true) {
  document.getElementById('site-view').classList.remove('hidden');
  document.getElementById('article-reader').classList.add('hidden');
  currentArticleId = null;
  if (window.location.hash.startsWith('#article-')) {
    window.history.pushState({}, '', window.location.pathname);
  }
  if (doRender) renderFilteredArticles();
}

function handleHashNavigation() {
  const hash = window.location.hash;
  if (hash.startsWith('#article-')) {
    const id = parseInt(hash.replace('#article-', ''), 10);
    if (!isNaN(id)) openArticlePage(id);
  }

  window.addEventListener('popstate', e => {
    if (e.state?.articleId) {
      openArticlePage(e.state.articleId);
    } else if (!document.getElementById('article-reader').classList.contains('hidden')) {
      closeArticlePage();
    }
  });
}

// ─── MARKDOWN RENDERER ───────────────────────────────
function renderMarkdown(text) {
  return text
    .split(/\n\n+/)
    .map(para => {
      para = para.trim();
      if (!para) return '';

      // Pure **heading** paragraph → <h3>
      if (/^\*\*[^*\n]+\*\*$/.test(para)) {
        const heading = para.replace(/^\*\*(.+)\*\*$/, '$1');
        return `<h3>${escapeHtml(heading)}</h3>`;
      }

      // List: every line starts with - or •
      const lines = para.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 1 && lines.every(l => /^[-•*] /.test(l))) {
        const items = lines.map(l =>
          `<li>${renderInline(l.replace(/^[-•*] /, ''))}</li>`
        );
        return `<ul>${items.join('')}</ul>`;
      }

      // Regular paragraph with inline styles
      const html = lines.map(l => renderInline(l)).join('<br>');
      return `<p>${html}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

function renderInline(text) {
  let html = escapeHtml(text);
  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  html = html.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
  return html;
}

// ─── LIKES ───────────────────────────────────────────
async function loadReaderLikes(articleId) {
  try {
    const { result } = await apiFetch('GET', `/api/likes/article/${articleId}`);
    if (result && result.success) {
      const count = result.data.count ?? 0;
      setTextContent('reader-like-count',    count);
      setTextContent('reaction-like-count',  count);
    }
  } catch (err) {
    console.warn('Error loading likes:', err);
  }
}

async function toggleReaderLike(articleId) {
  if (!currentUser) { openAuthModal(); return; }

  try {
    // The liker comes from the session; no user id is sent
    const { ok, result } = await apiFetch('POST', '/api/likes/toggle', { article_id: articleId });

    if (!ok) {
      if (result && result.error) alert(result.error);
      return;
    }

    document.getElementById('reader-like-btn')?.classList.toggle('liked', result.liked);
    document.getElementById('reaction-btn')?.classList.toggle('liked', result.liked);
    await loadReaderLikes(articleId);
  } catch (err) {
    console.warn('Error toggling like:', err);
  }
}

// ─── COMMENTS ────────────────────────────────────────
async function loadReaderComments(articleId) {
  const listEl = document.getElementById('reader-comments-list');
  if (!listEl) return;

  try {
    const { result } = await apiFetch('GET', `/api/comments/article/${articleId}`);
    if (result && result.success) {
      if (result.data.length === 0) {
        listEl.innerHTML = `<div class="loading-text">no comments yet — be the first to leave a note ♡</div>`;
      } else {
        listEl.innerHTML = result.data.map(c => `
          <div class="reader-comment-item" role="listitem">
            <div class="reader-comment-author">${escapeHtml(c.author_name)}</div>
            <div class="reader-comment-text">${escapeHtml(c.content)}</div>
          </div>`
        ).join('');
      }
    }
  } catch (err) {
    console.warn('Error loading comments:', err);
  }
}

async function postReaderComment(articleId) {
  const inputEl = document.getElementById('reader-comment-input');
  const btn     = document.getElementById('post-comment-btn');
  if (!inputEl) return;

  if (!currentUser) { openAuthModal(); return; }

  const content = inputEl.value.trim();
  if (!content) return;

  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  try {
    // The commenter comes from the session; no user id is sent
    const { ok, result } = await apiFetch('POST', '/api/comments', {
      article_id: articleId,
      content
    });

    if (ok) {
      inputEl.value = '';
      loadReaderComments(articleId);
    } else if (result && result.error) {
      alert(result.error);
    }
  } catch (err) {
    console.warn('Error posting comment:', err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'post'; }
  }
}

// ─── ARTICLE CRUD ─────────────────────────────────────
function openArticleModal(article = null) {
  document.getElementById('article-id').value        = article ? article.id        : '';
  document.getElementById('article-title').value     = article ? article.title     : '';
  document.getElementById('article-tags').value      = article ? (article.tags || '') : '';
  document.getElementById('article-image-url').value = article ? (article.image_url || '') : '';
  document.getElementById('article-content').value   = article ? article.content   : '';

  // Reset the file picker and preview the article's existing image.
  const fileInput = document.getElementById('article-image-file');
  if (fileInput) fileInput.value = '';
  showImagePreview(article ? (article.image_url || article.image_data) : '');

  document.getElementById('modal-title').textContent =
    article ? 'edit your story ✨' : 'write something ✨';
  document.getElementById('article-modal').classList.add('active');
}

// Shows or hides the image preview.
function showImagePreview(src) {
  const preview = document.getElementById('article-image-preview');
  if (!preview) return;
  if (src) {
    preview.src = src;
    preview.classList.remove('hidden');
  } else {
    preview.removeAttribute('src');
    preview.classList.add('hidden');
  }
}

// Previews the picked file and clears the URL field (one image only).
function handleImageFileChange() {
  const file = this.files && this.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert('Image is too large — please choose a file under 5MB.');
    this.value = '';
    return;
  }

  document.getElementById('article-image-url').value = '';
  showImagePreview(URL.createObjectURL(file));
}

function closeArticleModal() {
  document.getElementById('article-modal').classList.remove('active');
  document.getElementById('article-form').reset();
}

// Reads a File into a base64 data URL for the image_data column.
function readImageFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function handleSaveArticle(e) {
  e.preventDefault();

  // Writing requires a session — prompt to sign in.
  if (!currentUser) { openAuthModal(); return; }

  const id        = document.getElementById('article-id').value;
  const title     = document.getElementById('article-title').value.trim();
  const tags      = document.getElementById('article-tags').value.trim();
  let   image_url = document.getElementById('article-image-url').value.trim();
  const content   = document.getElementById('article-content').value.trim();

  const fileInput = document.getElementById('article-image-file');
  const file      = fileInput && fileInput.files ? fileInput.files[0] : null;

  if (file && file.size > 5 * 1024 * 1024) {
    alert('Image is too large — please choose a file under 5MB.');
    return;
  }

  const btn     = document.getElementById('save-article-btn');
  btn.textContent = 'publishing...';
  btn.disabled    = true;

  try {
    // An uploaded file becomes image_data and overrides the URL field.
    let image_data;
    if (file) {
      image_data = await readImageFileAsDataUrl(file);
      image_url = '';
    }

    const method = id ? 'PUT' : 'POST';
    const url    = id ? `/api/articles/${id}` : '/api/articles';

    // The author comes from the session; no user id is sent.
    const { ok, result } = await apiFetch(method, url, { title, tags, image_url, image_data, content });

    if (ok && result && result.success) {
      closeArticleModal();
      await loadArticles();
      // Re-open reader if we just edited an open article
      if (id) openArticlePage(parseInt(id, 10));
    } else {
      alert('Error saving: ' + ((result && result.error) || 'request failed'));
    }
  } catch (err) {
    console.error('Failed to save article:', err);
    alert('Failed to save. Please try again.');
  } finally {
    btn.textContent = 'publish ♡';
    btn.disabled    = false;
  }
}

async function openEditFromReader(articleId) {
  const article = articlesData.find(a => a.id === articleId);
  if (article) {
    openArticleModal(article);
    return;
  }

  const { result } = await apiFetch('GET', `/api/articles/${articleId}`);
  if (result && result.success) openArticleModal(result.data);
}

async function deleteArticleFromReader(id) {
  if (!confirm('Delete this post? This cannot be undone. ♡')) return;
  try {
    const { ok, result } = await apiFetch('DELETE', `/api/articles/${id}`);
    if (ok && result && result.success) {
      closeArticlePage();
      await loadArticles();
    } else {
      alert('Failed to delete: ' + ((result && result.error) || 'request failed'));
    }
  } catch (err) {
    console.error('Failed to delete:', err);
  }
}

// ─── CONTACT FORM ──────────────────────────────────────
async function handleContactSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const loading = document.getElementById('contact-loading');
  const error = document.getElementById('contact-error');
  const success = document.getElementById('contact-success');
  const submitBtn = form.querySelector('button[type="submit"]');

  // Reset status
  loading.classList.remove('hidden');
  error.classList.add('hidden');
  success.classList.add('hidden');
  submitBtn.disabled = true;

  try {
    // Send the contact form via EmailJS.
    await emailjs.sendForm('service_dt4km5i', 'template_1m9p8rp', form);

    success.classList.remove('hidden');
    form.reset();
  } catch (err) {
    console.error('EmailJS Error:', err);
    error.textContent = 'Oops! Something went wrong. Please try again later. ♡';
    error.classList.remove('hidden');
  } finally {
    loading.classList.add('hidden');
    submitBtn.disabled = false;
  }
}

// ─── UTILS ────────────────────────────────────────────
function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

function setTextContent(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ─── SLIDESHOW ────────────────────────────────────────
function initSlideshow() {
  const slides = document.getElementsByClassName('intro-slide');
  if (slides.length <= 1) return;

  startSlideTimer();
}

function startSlideTimer() {
  stopSlideTimer();
  slideInterval = setInterval(() => moveSlide(1), 3000);
}

function stopSlideTimer() {
  if (slideInterval) clearInterval(slideInterval);
}

function moveSlide(n) {
  const slides = document.getElementsByClassName('intro-slide');
  if (slides.length === 0) return;

  slides[currentSlideIndex].classList.remove('active');

  // Move to the next slide, wrapping around
  currentSlideIndex = (currentSlideIndex + n + slides.length) % slides.length;

  slides[currentSlideIndex].classList.add('active');

  // Restart the timer after a manual move
  startSlideTimer();
}
