const express = require('express');
const { body, param, query } = require('express-validator');
const {
  createTeacher,
  listTeachers,
  updateTeacher,
  updateTeacherStatus,
} = require('../controllers/teacherController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();
router.use(authenticate, authorize('admin'));

router.get(
  '/',
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().isString().trim().isLength({ max: 100 }),
  query('status').optional().isIn(['active', 'inactive']),
  query('department').optional().isMongoId(),
  validateRequest,
  listTeachers
);

router.post(
  '/',
  body('name').isString().trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail().isLength({ max: 254 }),
  body('password').isString().isLength({ min: 8, max: 128 }),
  body('department').optional({ values: 'falsy' }).isMongoId(),
  validateRequest,
  createTeacher
);

router.patch(
  '/:teacherId',
  param('teacherId').isMongoId(),
  body('name').optional().isString().trim().isLength({ min: 2, max: 100 }),
  body('email').optional().isEmail().normalizeEmail().isLength({ max: 254 }),
  body('department').optional({ values: 'falsy' }).isMongoId(),
  validateRequest,
  updateTeacher
);

router.patch(
  '/:teacherId/status',
  param('teacherId').isMongoId(),
  body('status').isIn(['active', 'inactive']),
  validateRequest,
  updateTeacherStatus
);

module.exports = router;
