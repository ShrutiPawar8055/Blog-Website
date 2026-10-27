const express = require('express');
const userController = require('../controllers/userController');
const { requireAuth, requireRole, requireSelfOrAdmin } = require('../middleware/authMiddleware');
const { writeLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

// User routes (/api/users); all protected (admin or self).

router.route('/')
  .get(requireAuth, requireRole('admin'), userController.getAllUsers)
  .post(writeLimiter, requireAuth, requireRole('admin'), userController.createUser);

// Declare /:id/role before the generic /:id routes.
router.patch(
  '/:id/role',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  userController.updateUserRole
);

router.route('/:id')
  .get(requireAuth, requireSelfOrAdmin, userController.getUserById)
  .put(writeLimiter, requireAuth, requireSelfOrAdmin, userController.updateUser)
  .delete(writeLimiter, requireAuth, requireRole('admin'), userController.deleteUser);

module.exports = router;
