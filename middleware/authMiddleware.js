const User = require('../models/userModel');
const { SESSION_COOKIE_NAME } = require('../config/sessionConfig');
const { toPositiveInt } = require('./validate');

// loads the session user fresh from the db each request.
async function loadSessionUser(req, res, next) {
  if (!req.session || !req.session.userId) return next();

  try {
    const user = await User.getUserById(req.session.userId);

    if (!user) {
      // account deleted: drop the stale session
      return req.session.destroy(() => {
        res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
        next();
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

// blocks anonymous requests; run after loadSessionUser.
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in.'
    });
  }
  return next();
}

// allows only the listed roles; e.g. requireRole('author', 'admin').
function requireRole(...allowedRoles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to perform this action.'
      });
    }

    return next();
  };
}

// true if user owns the resource or is an admin.
function isOwnerOrAdmin(user, ownerId) {
  if (!user) return false;
  return user.role === 'admin' || user.id === Number(ownerId);
}

// admins may act on anyone; users only on themselves.
function requireSelfOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in.'
    });
  }

  const targetId = toPositiveInt(req.params.id);
  if (targetId === null) {
    return res.status(400).json({ success: false, error: 'Invalid user id' });
  }

  if (req.user.role !== 'admin' && req.user.id !== targetId) {
    return res.status(403).json({
      success: false,
      error: 'You may only manage your own account.'
    });
  }

  return next();
}

module.exports = {
  loadSessionUser,
  requireAuth,
  requireRole,
  requireSelfOrAdmin,
  isOwnerOrAdmin
};
