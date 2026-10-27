const crypto = require('crypto');

// CSRF: session token must be echoed in the X-CSRF-Token header.

const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// new random CSRF token
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

// creates the session token once
function ensureCsrfToken(req, res, next) {
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  next();
}

// timing-safe string comparison.
function constantTimeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;

  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

// rejects unsafe requests without a matching token.
function verifyCsrfToken(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const sessionToken = req.session ? req.session.csrfToken : null;
  const requestToken = req.get(CSRF_HEADER);

  if (!sessionToken || !constantTimeEquals(sessionToken, requestToken)) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or missing CSRF token.'
    });
  }

  return next();
}

module.exports = {
  CSRF_HEADER,
  generateCsrfToken,
  ensureCsrfToken,
  verifyCsrfToken
};
