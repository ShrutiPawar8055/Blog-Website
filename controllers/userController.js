const bcrypt = require('bcryptjs');
const User = require('../models/userModel');
const { isValidEmail, isValidUsername, isValidPassword, toPositiveInt } = require('../middleware/validate');

// User endpoints; role changes are admin-only.

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);
const ASSIGNABLE_ROLES = ['user', 'author', 'admin'];

// Lists all users (admin).
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.getAllUsers();
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
};

// Gets a user by id (self or admin).
exports.getUserById = async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (id === null) {
      return res.status(400).json({ success: false, error: 'Invalid user id' });
    }

    const user = await User.getUserById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
};

// Creates a user (admin).
exports.createUser = async (req, res) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body.password;
    const role = typeof req.body.role === 'string' ? req.body.role.trim() : 'user';

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

    if (!ASSIGNABLE_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}.`
      });
    }

    if (await User.emailExists(email)) {
      return res.status(409).json({ success: false, error: 'That email address is already registered.' });
    }
    if (await User.usernameExists(username)) {
      return res.status(409).json({ success: false, error: 'That username is already taken.' });
    }

    // Store the hash, never the plaintext password.
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const userId = await User.createUser({ username, email, passwordHash, role });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      id: userId
    });
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        error: 'Username or email already exists'
      });
    }
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
};

// Updates a user's profile (self or admin).
exports.updateUser = async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (id === null) {
      return res.status(400).json({ success: false, error: 'Invalid user id' });
    }

    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!isValidUsername(username) || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid username and email address.'
      });
    }

    const existing = await User.getUserById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Body role is ignored; roles change only via admin PATCH /:id/role.
    await User.updateUser(id, { username, email });

    res.status(200).json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Username or email already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
};

// Changes a user's role (admin).
exports.updateUserRole = async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (id === null) {
      return res.status(400).json({ success: false, error: 'Invalid user id' });
    }

    const role = typeof req.body.role === 'string' ? req.body.role.trim() : '';
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}.`
      });
    }

    // Stop an admin removing their own admin role.
    if (req.user.id === id && role !== 'admin') {
      return res.status(400).json({
        success: false,
        error: 'You cannot remove your own admin role.'
      });
    }

    const existing = await User.getUserById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    await User.updateUserRole(id, role);

    res.status(200).json({ success: true, message: `User role updated to "${role}".` });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ success: false, error: 'Failed to update user role' });
  }
};

// Deletes a user (admin; cascades to their content).
exports.deleteUser = async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (id === null) {
      return res.status(400).json({ success: false, error: 'Invalid user id' });
    }

    if (req.user.id === id) {
      return res.status(400).json({
        success: false,
        error: 'Use the sign-out endpoint to end your own session; admins cannot delete themselves.'
      });
    }

    const existing = await User.getUserById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    await User.deleteUser(id);

    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
};
