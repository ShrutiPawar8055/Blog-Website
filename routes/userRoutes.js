const express = require('express');
const userController = require('../controllers/userController');

const router = express.Router();

/**
 * User Routes (/api/users)
 */

router.route('/')
  .get(userController.getAllUsers)
  .post(userController.createUser);

router.route('/:id')
  .get(userController.getUserById);

module.exports = router;
