// input validation helpers; never throw, never touch the db.

// deliberately simple but strict
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,50}$/;

// true for a valid email address.
function isValidEmail(value) {
  return typeof value === 'string' && value.length <= 254 && EMAIL_PATTERN.test(value.trim());
}

// true for a valid username.
function isValidUsername(value) {
  return typeof value === 'string' && USERNAME_PATTERN.test(value.trim());
}

// min 8 chars; bcrypt only uses the first 72 bytes.
function isValidPassword(value) {
  return typeof value === 'string' && value.length >= 8 && Buffer.byteLength(value, 'utf8') <= 72;
}

// required text within [min, max] bounds.
function isText(value, { min = 1, max = 255 } = {}) {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
}

// optional text; may be empty but must stay within bounds.
function isOptionalText(value, { max = 255 } = {}) {
  if (value === undefined || value === null || value === '') return true;
  return typeof value === 'string' && value.trim().length <= max;
}

// parses a positive integer id, else null.
function toPositiveInt(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return parsed > 0 ? parsed : null;
  }
  return null;
}

module.exports = {
  isValidEmail,
  isValidUsername,
  isValidPassword,
  isText,
  isOptionalText,
  toPositiveInt
};
