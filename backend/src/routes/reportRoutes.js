const express = require('express');
const { query } = require('express-validator');
const { getReport } = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();
router.use(authenticate, authorize('admin'));

router.get(
  '/',
  query('from').optional().isISO8601({ strict: true, strictSeparator: true }),
  query('to').optional().isISO8601({ strict: true, strictSeparator: true }),
  query('teacherId').optional().isMongoId(),
  query('departmentId').optional().isMongoId(),
  query('subjectId').optional().isMongoId(),
  query('status').optional().isIn(['present', 'late', 'absent', 'approved_leave']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('format').optional().isIn(['json', 'csv']),
  validateRequest,
  getReport
);

module.exports = router;
