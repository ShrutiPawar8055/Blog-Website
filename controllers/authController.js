const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/userModel');
const { generateCsrfToken } = require('../middleware/csrf');
const { isValidEmail, isValidUsername, isValidPassword } = require('../middleware/validate');
const { SESSION_COOKIE_NAME } = require('../config/sessionConfig');

// Auth controller: register, login, logout, current user.

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

// Default role for new sign-ups (author).
const DEFAULT_REGISTRATION_ROLE = process.env.DEFAULT_REGISTRATION_ROLE || 'author';

// Dummy hash keeps login timing constant for unknown emails.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), BCRYPT_ROUNDS);

// Returns a user object without the password hash.
function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    created_at: user.created_at
  };
}

// Starts a fresh session after sign-in (new id and CSRF token).
function establishSession(req, res, user, statusCode, message) {
  req.session.regenerate((regenerateError) => {
    if (regenerateError) {
      console.error('Session regeneration failed:', regenerateError);
      return res.status(500).json({
        success: false,
        error: 'Could not start a session. Please try again.'
      });
    }

    req.session.userId = user.id;
    req.session.csrfToken = generateCsrfToken();

    // Save before responding so the cookie is already valid.
    return req.session.save((saveError) => {
      if (saveError) {
        console.error('Session save failed:', saveError);
        return res.status(500).json({
          success: false,
          error: 'Could not start a session. Please try again.'
        });
      }

      return res.status(statusCode).json({
        success: true,
        message,
        data: toPublicUser(user),
        csrfToken: req.session.csrfToken
      });
    });
  });
}

// Returns the CSRF token for the current session.
exports.getCsrfToken = (req, res) => {
  res.status(200).json({
    success: true,
    csrfToken: req.session.csrfToken
  });
};

// Registers a new account and signs in.
exports.register = async (req, res) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body.password;

    // ── Validation ──
    if (!isValidUsername(username)) {
      return res.status(400).json({
        success: false,
        error: 'Username must be 3-50 characters and may only contain letters, numbers, dots, dashes and underscores.'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters (maximum 72 bytes).'
      });
    }

    // ── Uniqueness ──
    if (await User.emailExists(email)) {
      return res.status(409).json({ success: false, error: 'That email address is already registered.' });
    }

    if (await User.usernameExists(username)) {
      return res.status(409).json({ success: false, error: 'That username is already taken.' });
    }

    // ── Store the hash, never the password ──
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const userId = await User.createUser({
      username,
      email,
      passwordHash,
      role: DEFAULT_REGISTRATION_ROLE
    });

    const user = await User.getUserById(userId);

    return establishSession(req, res, user, 201, 'Account created successfully.');
  } catch (error) {
    // Unique constraint catches races between the earlier checks.
    if (error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        error: 'That username or email address is already registered.'
      });
    }

    console.error('Error registering user:', error);
    return res.status(500).json({ success: false, error: 'Failed to create account.' });
  }
};

// Signs in with email and password.
exports.login = async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const user = await User.findByEmailWithPassword(email);

    // Always compare so timing does not reveal if the email exists.
    let passwordMatches = false;
    try {
      passwordMatches = await bcrypt.compare(password, user ? user.password : DUMMY_PASSWORD_HASH);
    } catch (compareError) {
      passwordMatches = false;
    }

    if (!user || !passwordMatches) {
      // Same message for both failure cases.
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    return establishSession(req, res, user, 200, 'Signed in successfully.');
  } catch (error) {
    console.error('Error signing in:', error);
    return res.status(500).json({ success: false, error: 'Failed to sign in.' });
  }
};

// Signs out and destroys the session.
exports.logout = (req, res) => {
  req.session.destroy((error) => {
    if (error) console.error('Error destroying session:', error);

    // Clear the cookie even if destroy failed.
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });

    if (error) {
      return res.status(500).json({ success: false, error: 'Failed to sign out.' });
    }

    return res.status(200).json({ success: true, message: 'Signed out successfully.' });
  });
};

// Returns the currently authenticated user.
exports.getCurrentUser = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Not authenticated.' });
  }

  return res.status(200).json({
    success: true,
    data: toPublicUser(req.user),
    role: req.user.role
  });
};
