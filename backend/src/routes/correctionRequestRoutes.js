const express = require('express');
const { body, param, query } = require('express-validator');
const { createCorrection, listCorrections, reviewCorrection } = require('../controllers/requestController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();
router.use(authenticate);

router.get(
  '/',
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['pending', 'approved', 'rejected']),
  query('teacherId').optional().isMongoId(),
  validateRequest,
  listCorrections
);

router.post(
  '/',
  authorize('teacher'),
  body('attendance').isMongoId(),
  body('requestedCheckIn').optional({ values: 'falsy' }).isISO8601(),
  body('requestedCheckOut').optional({ values: 'falsy' }).isISO8601(),
  body('reason').isString().trim().isLength({ min: 5, max: 1000 }),
  validateRequest,
  createCorrection
);

router.patch(
  '/:requestId/review',
  authorize('admin'),
  param('requestId').isMongoId(),
  body('status').isIn(['approved', 'rejected']),
  body('reviewerNote').optional().isString().trim().isLength({ max: 1000 }),
  validateRequest,
  reviewCorrection
);

module.exports = router;
