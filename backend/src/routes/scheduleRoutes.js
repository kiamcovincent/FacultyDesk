const express = require('express');
const { body, param, query } = require('express-validator');
const { createSchedule, listSchedules, updateSchedule } = require('../controllers/academicController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
router.use(authenticate);

router.get(
  '/',
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('teacherId').optional().isMongoId(),
  query('subjectId').optional().isMongoId(),
  query('dayOfWeek').optional().isInt({ min: 0, max: 6 }).toInt(),
  query('active').optional().isBoolean().toBoolean(),
  validateRequest,
  listSchedules
);

router.post(
  '/',
  authorize('admin'),
  body('teacher').isMongoId(),
  body('subject').isMongoId(),
  body('className').isString().trim().isLength({ min: 1, max: 100 }),
  body('dayOfWeek').isInt({ min: 0, max: 6 }).toInt(),
  body('startTime').matches(timePattern),
  body('endTime').matches(timePattern),
  body('timeZone').optional().isString().trim().isLength({ min: 1, max: 100 }),
  validateRequest,
  createSchedule
);

router.patch(
  '/:scheduleId',
  authorize('admin'),
  param('scheduleId').isMongoId(),
  body('teacher').optional().isMongoId(),
  body('subject').optional().isMongoId(),
  body('className').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('dayOfWeek').optional().isInt({ min: 0, max: 6 }).toInt(),
  body('startTime').optional().matches(timePattern),
  body('endTime').optional().matches(timePattern),
  body('timeZone').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('active').optional().isBoolean().toBoolean(),
  validateRequest,
  updateSchedule
);

module.exports = router;
