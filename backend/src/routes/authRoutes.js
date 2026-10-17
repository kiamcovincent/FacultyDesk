const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const { register, login, logout, getProfile } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_AUTH_ATTEMPTS',
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
});

router.post(
  '/register',
  authLimiter,
  body('name').isString().trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail().isLength({ max: 254 }),
  body('password').isString().isLength({ min: 8, max: 128 }),
  body('departmentId').optional({ values: 'falsy' }).isMongoId(),
  validateRequest,
  register
);

router.post(
  '/login',
  authLimiter,
  body('email').isEmail().normalizeEmail().isLength({ max: 254 }),
  body('password').isString().notEmpty().isLength({ max: 128 }),
  validateRequest,
  login
);

router.post('/logout', logout);
router.get('/me', authenticate, getProfile);

module.exports = router;
