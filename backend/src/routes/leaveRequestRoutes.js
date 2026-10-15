const express = require('express');
const { body, param, query } = require('express-validator');
const { createLeave, listLeave, reviewLeave } = require('../controllers/requestController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();
router.use(authenticate);

router.get(
  '/',
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['pending', 'approved', 'rejected']),
  query('from').optional().isISO8601({ strict: true, strictSeparator: true }),
  query('to').optional().isISO8601({ strict: true, strictSeparator: true }),
  validateRequest,
  listLeave
);

router.post(
  '/',
  authorize('teacher'),
  body('startDate').isISO8601({ strict: true, strictSeparator: true }),
  body('endDate').isISO8601({ strict: true, strictSeparator: true }),
  body('reason').isString().trim().isLength({ min: 5, max: 1000 }),
  validateRequest,
  createLeave
);

router.patch(
  '/:requestId/review',
  authorize('admin'),
  param('requestId').isMongoId(),
  body('status').isIn(['approved', 'rejected']),
  body('reviewerNote').optional().isString().trim().isLength({ max: 1000 }),
  validateRequest,
  reviewLeave
);

module.exports = router;
