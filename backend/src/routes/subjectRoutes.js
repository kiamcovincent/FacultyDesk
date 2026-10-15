const express = require('express');
const { body, param, query } = require('express-validator');
const { createSubject, listSubjects, updateSubject } = require('../controllers/academicController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();
router.use(authenticate);

router.get(
  '/',
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().isString().trim().isLength({ max: 100 }),
  query('department').optional().isMongoId(),
  query('teacherId').optional().isMongoId(),
  query('active').optional().isBoolean().toBoolean(),
  validateRequest,
  listSubjects
);

router.post(
  '/',
  authorize('admin'),
  body('name').isString().trim().isLength({ min: 2, max: 120 }),
  body('code').isString().trim().isLength({ min: 2, max: 20 }).matches(/^[a-zA-Z0-9-]+$/),
  body('department').isMongoId(),
  body('teachers').optional().isArray({ max: 100 }),
  body('teachers.*').optional().isMongoId(),
  validateRequest,
  createSubject
);

router.patch(
  '/:subjectId',
  authorize('admin'),
  param('subjectId').isMongoId(),
  body('name').optional().isString().trim().isLength({ min: 2, max: 120 }),
  body('code').optional().isString().trim().isLength({ min: 2, max: 20 }).matches(/^[a-zA-Z0-9-]+$/),
  body('department').optional().isMongoId(),
  body('teachers').optional().isArray({ max: 100 }),
  body('teachers.*').optional().isMongoId(),
  body('active').optional().isBoolean().toBoolean(),
  validateRequest,
  updateSubject
);

module.exports = router;
