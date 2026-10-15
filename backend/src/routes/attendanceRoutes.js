const express = require('express');
const { query } = require('express-validator');
const { checkIn, checkOut, myHistory, listAttendance } = require('../controllers/attendanceController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();
const dateQuery = (field) => query(field).optional().matches(/^\d{4}-\d{2}-\d{2}$/);
const paginationRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sortBy').optional().isIn(['date', 'checkIn', 'createdAt']),
  query('order').optional().isIn(['asc', 'desc']),
];

router.post('/check-in', authenticate, authorize('teacher'), checkIn);
router.post('/check-out', authenticate, authorize('teacher'), checkOut);
router.get(
  '/my-history',
  authenticate,
  authorize('teacher'),
  dateQuery('date'),
  dateQuery('from'),
  dateQuery('to'),
  ...paginationRules,
  validateRequest,
  myHistory
);
router.get(
  '/',
  authenticate,
  authorize('admin'),
  dateQuery('date'),
  dateQuery('from'),
  dateQuery('to'),
  query('teacherId').optional().isMongoId(),
  query('status').optional().isIn(['present', 'late', 'absent', 'approved_leave']),
  ...paginationRules,
  validateRequest,
  listAttendance
);

module.exports = router;
