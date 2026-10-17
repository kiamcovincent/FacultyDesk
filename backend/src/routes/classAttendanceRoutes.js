const express = require('express');
const { body, query } = require('express-validator');
const {
  getClassAttendance,
  saveClassAttendance,
} = require('../controllers/classroomController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { isValidDateKey } = require('../services/classroomService');

const router = express.Router();
router.use(authenticate, authorize('teacher'));

router.get(
  '/',
  query('scheduleId').isMongoId(),
  query('date').custom(isValidDateKey),
  validateRequest,
  getClassAttendance
);

router.put(
  '/',
  body('scheduleId').isMongoId(),
  body('date').custom(isValidDateKey),
  body('description').optional().isString().trim().isLength({ max: 500 }),
  body('records').isArray({ min: 1, max: 500 }),
  body('records.*.studentId').isMongoId(),
  body('records.*.status').isIn(['present', 'absent', 'late']),
  validateRequest,
  saveClassAttendance
);

module.exports = router;