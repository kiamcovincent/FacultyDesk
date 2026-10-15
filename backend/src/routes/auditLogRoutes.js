const express = require('express');
const { query } = require('express-validator');
const { listAuditLogs } = require('../controllers/auditLogController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();
router.use(authenticate, authorize('admin'));

router.get(
  '/',
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('actorId').optional().isMongoId(),
  query('action').optional().isString().trim().isLength({ max: 120 }),
  query('entityType').optional().isString().trim().isLength({ max: 100 }),
  query('from').optional().isISO8601({ strict: true, strictSeparator: true }),
  query('to').optional().isISO8601({ strict: true, strictSeparator: true }),
  validateRequest,
  listAuditLogs
);

module.exports = router;
